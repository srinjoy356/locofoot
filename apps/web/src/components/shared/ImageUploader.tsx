"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  ownerType: "USER_AVATAR" | "TEAM_LOGO";
  ownerId: string;
  onUploadSuccess: (url: string) => void;
}

export function ImageUploader({ ownerType, ownerId, onUploadSuccess }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // 1. Get user token for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // 2. Request signature from FastAPI
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const sigRes = await fetch(`${backendUrl}/media/signature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ ownerType, ownerId })
      });

      if (!sigRes.ok) throw new Error("Failed to get upload signature");
      const sig = await sigRes.json();

      // 3. Upload to Cloudinary
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.api_key);
      form.append("timestamp", sig.timestamp.toString());
      form.append("signature", sig.signature);
      form.append("folder", sig.folder);
      if (sig.tags) form.append("tags", sig.tags);

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
        { method: "POST", body: form }
      );

      if (!cloudRes.ok) throw new Error("Cloudinary upload failed");
      const uploaded = await cloudRes.json();

      // 4. Save to Postgres via Supabase
      const { data: asset, error: dbError } = await supabase
        .from("media_assets")
        .insert({
          owner_type: ownerType,
          owner_id: ownerId,
          cloudinary_public_id: uploaded.public_id,
          secure_url: uploaded.secure_url,
          resource_type: "image",
          width: uploaded.width,
          height: uploaded.height,
          format: uploaded.format,
          bytes: uploaded.bytes,
          uploaded_by: session.user.id
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // 5. If it's a user avatar, update the users table
      if (ownerType === "USER_AVATAR") {
        const { error: userError } = await supabase
          .from("users")
          .update({ avatar_media_id: asset.id })
          .eq("id", ownerId);

        if (userError) throw userError;
      }

      onUploadSuccess(uploaded.secure_url);
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleUpload} 
        disabled={uploading} 
      />
      {uploading && <p className="text-sm text-blue-500">Uploading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
