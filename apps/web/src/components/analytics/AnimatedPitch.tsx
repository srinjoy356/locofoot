'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getGeometricPositions, getInitials } from '@/lib/pitchUtils';
import { motion } from 'framer-motion';

type PitchActor = {
  id: string;
  name: string;
  team: 'home' | 'away';
  position?: 'GK' | 'DEF' | 'MID' | 'FWD' | 'SUB';
  number?: string;
};

type PitchEvent = {
  id: string;
  type: string;
  actor?: PitchActor;
  target?: PitchActor;
  minute: number;
};

type Props = {
  activeEvent: PitchEvent | null;
  homeStarters?: any[];
  awayStarters?: any[];
  homeSubs?: any[];
  awaySubs?: any[];
};

export function AnimatedPitch({ activeEvent, homeStarters = [], awayStarters = [], homeSubs = [], awaySubs = [] }: Props) {
  // We manage the pitch players locally so we can swap them for substitutions visually
  const [localHomeStarters, setLocalHomeStarters] = useState<any[]>([]);
  const [localAwayStarters, setLocalAwayStarters] = useState<any[]>([]);
  const [localHomeSubs, setLocalHomeSubs] = useState<any[]>([]);
  const [localAwaySubs, setLocalAwaySubs] = useState<any[]>([]);

  // Keep refs to the latest state so our timeouts don't read stale closures
  const latestArrays = useRef({
    homeStarters: [] as any[],
    awayStarters: [] as any[],
    homeSubs: [] as any[],
    awaySubs: [] as any[],
  });

  // Initialize locals when props change
  useEffect(() => {
    setLocalHomeStarters(homeStarters);
    setLocalAwayStarters(awayStarters);
    setLocalHomeSubs(homeSubs);
    setLocalAwaySubs(awaySubs);
    
    latestArrays.current = { homeStarters, awayStarters, homeSubs, awaySubs };
  }, [homeStarters, awayStarters, homeSubs, awaySubs]);

    // General FX state
  const [ball, setBall] = useState<any>({ left: '50%', top: '50%', opacity: 0, scale: 1, rotate: 0, boxShadow: 'none', zIndex: 20 });
  const [fx, setFx] = useState({ text: '', left: '50%', top: '50%', opacity: 0, className: '', scale: 1 });
  
  // Specific actor overrides for choreography
  const [actorOverride, setActorOverride] = useState<any>(null);
  const [targetOverride, setTargetOverride] = useState<any>(null);
  const [possession, setPossession] = useState<'home'|'away'|'neutral'>('neutral');

  const timers = useRef<NodeJS.Timeout[]>([]);
  const processedEventId = useRef<string | null>(null);

  const resetPitch = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBall({ left: '50%', top: '50%', opacity: 0, scale: 1, rotate: 0, boxShadow: 'none', zIndex: 20 });
    setFx({ text: '', left: '50%', top: '50%', opacity: 0, className: '', scale: 1 });
    setActorOverride(null);
    setTargetOverride(null);
  };

  const schedule = (fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay);
    timers.current.push(t);
  };

  useEffect(() => {
    if (!activeEvent) return;
    if (processedEventId.current === activeEvent.id) return; // Prevent double-processing
    
    processedEventId.current = activeEvent.id;
    resetPitch();
    
    // Determine possession based on the actor
    let newPossession: 'home' | 'away' | 'neutral' = 'neutral';
    if (activeEvent.actor?.id) {
      if (latestArrays.current.homeStarters.some(p => p.id === activeEvent.actor?.id) || 
          latestArrays.current.homeSubs.some(p => p.id === activeEvent.actor?.id) || 
          activeEvent.actor?.team === 'home') {
        newPossession = 'home';
      } else {
        newPossession = 'away';
      }
    }
    setPossession(newPossession);
    

    // Pre-calculate positions for the current possession state
    const homePos = getGeometricPositions(latestArrays.current.homeStarters.length, true, newPossession);
    const awayPos = getGeometricPositions(latestArrays.current.awayStarters.length, false, newPossession);

    const getPos = (actorOrTarget?: { id?: string | null, name?: string | null }) => {
      if (!actorOrTarget || (!actorOrTarget.id && !actorOrTarget.name)) return null;
      let idx = latestArrays.current.homeStarters.findIndex(p => 
        (actorOrTarget.id && p.id === actorOrTarget.id) || 
        (actorOrTarget.name && p.name === actorOrTarget.name)
      );
      if (idx !== -1) return { ...homePos[idx], isHome: true };
      idx = latestArrays.current.awayStarters.findIndex(p => 
        (actorOrTarget.id && p.id === actorOrTarget.id) || 
        (actorOrTarget.name && p.name === actorOrTarget.name)
      );
      if (idx !== -1) return { ...awayPos[idx], isHome: false };
      return null;
    };

    
    schedule(() => {
      const type = activeEvent.type;
      const actorInfo = activeEvent.actor;
      const targetInfo = activeEvent.target;
      
      const actorPos = getPos(actorInfo);
      const targetPos = getPos(targetInfo);

      const actorId = actorInfo?.id;
      const targetId = targetInfo?.id;

      const aLeft = actorPos ? actorPos.x : '50%';
      const aTop = actorPos ? actorPos.y : '50%';
      const tLeft = targetPos ? targetPos.x : '50%';
      const tTop = targetPos ? targetPos.y : '50%';

      const isHomeActor = actorPos ? actorPos.isHome : activeEvent.actor?.team === 'home';
      const goalY = isHomeActor ? '0%' : '100%';
      const ownGoalY = isHomeActor ? '100%' : '0%';
      
      const midLeft = `calc((${aLeft} + ${tLeft}) / 2)`;
      const midTop = `calc((${aTop} + ${tTop}) / 2)`;

      if (type === 'SUBSTITUTION') {
         const isHome = latestArrays.current.homeStarters.some(p => p.id === actorId) || 
                        latestArrays.current.homeSubs.some(p => p.id === actorId) || 
                        activeEvent.actor?.team === 'home';
         setActorOverride({ id: actorId, opacity: 0, scale: 0.5 });
         setFx({ text: '🔄', left: aLeft, top: aTop, opacity: 1, scale: 1.5, className: 'anim-pop' });
         
         schedule(() => {
            if (isHome) {
              const out = latestArrays.current.homeStarters.find(p => p.id === actorId);
              const tgt = latestArrays.current.homeSubs.find(p => p.id === targetId);
              if (out && tgt) {
                const newStarters = [...latestArrays.current.homeStarters.filter(p => p.id !== actorId), tgt];
                const newSubs = [...latestArrays.current.homeSubs.filter(p => p.id !== targetId), out];
                latestArrays.current.homeStarters = newStarters;
                latestArrays.current.homeSubs = newSubs;
                setLocalHomeStarters(newStarters);
                setLocalHomeSubs(newSubs);
              }
            } else {
              const out = latestArrays.current.awayStarters.find(p => p.id === actorId);
              const tgt = latestArrays.current.awaySubs.find(p => p.id === targetId);
              if (out && tgt) {
                const newStarters = [...latestArrays.current.awayStarters.filter(p => p.id !== actorId), tgt];
                const newSubs = [...latestArrays.current.awaySubs.filter(p => p.id !== targetId), out];
                latestArrays.current.awayStarters = newStarters;
                latestArrays.current.awaySubs = newSubs;
                setLocalAwayStarters(newStarters);
                setLocalAwaySubs(newSubs);
              }
            }
            setActorOverride(null);
         }, 800);
      }
      else if (type === 'PASS' || type === 'DISTRIBUTION') {
        setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1, rotate: 0 });
        if (actorId) setActorOverride({ id: actorId, scale: 1.15, zIndex: 30 });
        
        schedule(() => {
          setBall({ left: tLeft, top: tTop, opacity: 1, scale: 1, rotate: 720 });
          if (targetId) setTargetOverride({ id: targetId, scale: 1.15, zIndex: 30 });
          if (actorId) setActorOverride({ id: actorId, scale: 1 });
        }, 150);
        
        schedule(() => {
          if (targetId) setTargetOverride({ id: targetId, scale: 1 });
        }, 450);
      }
      else if (type === 'LONG_BALL') {
        setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, scale: 1.2, rotate: -15 });
        
        schedule(() => {
          setBall({ left: midLeft, top: midTop, opacity: 1, scale: 3.5, rotate: 360, boxShadow: '0 25px 35px rgba(0,0,0,0.6)', zIndex: 40 });
          if (actorId) setActorOverride({ id: actorId, scale: 1, rotate: 0 });
        }, 250);
        
        schedule(() => {
          setBall({ left: tLeft, top: tTop, opacity: 1, scale: 1, rotate: 720, boxShadow: 'none', zIndex: 20 });
          if (targetId) setTargetOverride({ id: targetId, scale: 1.2 });
        }, 600);
        
        schedule(() => {
          if (targetId) setTargetOverride({ id: targetId, scale: 1 });
        }, 900);
      }
      else if (type === 'CROSS') {
        setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, scale: 1.2, rotate: 15 });
        
        schedule(() => {
          setBall({ left: midLeft, top: midTop, opacity: 1, scale: 2.5, rotate: -360, boxShadow: '0 15px 25px rgba(0,0,0,0.5)', zIndex: 40 }); 
          if (actorId) setActorOverride({ id: actorId, scale: 1, rotate: 0 });
        }, 300);
        
        schedule(() => {
          setBall({ left: tLeft, top: tTop, opacity: 1, scale: 1, rotate: -720, boxShadow: 'none' });
          if (targetId) setTargetOverride({ id: targetId, scale: 1.2 });
        }, 700);
        schedule(() => {
          if (targetId) setTargetOverride({ id: targetId, scale: 1 });
        }, 1000);
      }
      else if (type === 'DRIBBLE' || type === 'OFF_BALL_RUN') {
        if (type === 'DRIBBLE') setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, top: aTop, left: aLeft });
        
        schedule(() => {
          const destY = `calc(${aTop} + ${isHomeActor ? '-8%' : '8%'})`;
          if (type === 'DRIBBLE') setBall({ left: aLeft, top: destY, opacity: 1, scale: 1, rotate: 180 });
          if (actorId) setActorOverride({ id: actorId, top: destY, left: aLeft, scale: 1.1, rotate: 10 });
        }, 150);
        
        schedule(() => {
          const destY2 = `calc(${aTop} + ${isHomeActor ? '-16%' : '16%'})`;
          if (type === 'DRIBBLE') setBall({ left: aLeft, top: destY2, opacity: 1, scale: 1, rotate: 360 });
          if (actorId) setActorOverride({ id: actorId, top: destY2, left: aLeft, scale: 1, rotate: -10 });
        }, 400);
      }
      else if (type === 'SHOT') {
        setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, scale: 1.3, rotate: -20 });
        
        schedule(() => {
          setBall({ left: '50%', top: goalY, opacity: 1, scale: 0.8, rotate: 1080 });
          if (actorId) setActorOverride({ id: actorId, scale: 1, rotate: 0 });
        }, 200);
      }
      else if (type === 'ASSIST') {
        setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, scale: 1.2 });
        
        schedule(() => {
          setBall({ left: tLeft, top: tTop, opacity: 1, scale: 1, rotate: 360 });
          if (targetId) setTargetOverride({ id: targetId, scale: 1.2 });
          if (actorId) setActorOverride({ id: actorId, scale: 1 });
        }, 250);
        
        schedule(() => {
          const destY = `calc(${tTop} + ${isHomeActor ? '-10%' : '10%'})`;
          setBall({ left: tLeft, top: destY, opacity: 1, scale: 1, rotate: 720 });
          if (targetId) setTargetOverride({ id: targetId, top: destY, left: tLeft, scale: 1.1, rotate: 15 });
        }, 500);
      }
      else if (type === 'GOAL') {
        setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, scale: 1.3, rotate: -15 });
        
        schedule(() => {
          setBall({ left: '50%', top: goalY, opacity: 1, scale: 0.9, rotate: 1080, boxShadow: 'inset 0 0 10px white' });
          if (actorId) setActorOverride({ id: actorId, scale: 1, rotate: 0 });
        }, 250);
        
        schedule(() => {
          setFx({ text: 'GOAL!', left: '50%', top: isHomeActor ? '15%' : '85%', opacity: 1, scale: 2, className: 'anim-pop text-glow' });
          if (actorId) setActorOverride({ id: actorId, scale: 1.6, rotate: 360, zIndex: 50 }); 
        }, 500);
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, scale: 1, rotate: 0, zIndex: 20 });
        }, 1500);
      }
      else if (type === 'TACKLE') {
        setBall({ left: tLeft, top: tTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop });
        if (targetId) setTargetOverride({ id: targetId, left: tLeft, top: tTop, scale: 1.1 });
        
        schedule(() => {
           if (actorId) setActorOverride({ id: actorId, left: tLeft, top: tTop, rotate: 75, scale: 1.1 });
           const popLeft = `calc(${tLeft} + 8%)`;
           const popTop = `calc(${tTop} + 8%)`;
           setBall({ left: popLeft, top: popTop, opacity: 1, scale: 1.5, rotate: 360 });
           if (targetId) setTargetOverride({ id: targetId, rotate: -25, scale: 1.2 });
           setFx({ text: '💥', left: tLeft, top: tTop, opacity: 1, scale: 1.5, className: 'anim-pop' });
        }, 200);
        
        schedule(() => {
           if (targetId) setTargetOverride({ id: targetId, rotate: 0, scale: 1 });
           if (actorId) setActorOverride({ id: actorId, rotate: 0, scale: 1 });
           setBall({ left: `calc(${tLeft} + 12%)`, top: `calc(${tTop} + 12%)`, opacity: 1, scale: 1, rotate: 720 });
        }, 600);
      }
      else if (type === 'INTERCEPTION') {
        setBall({ left: tLeft, top: tTop, opacity: 1, scale: 1 }); 
        if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop });
        
        schedule(() => {
           if (actorId) setActorOverride({ id: actorId, left: midLeft, top: midTop, scale: 1.4, zIndex: 40 });
           setBall({ left: midLeft, top: midTop, opacity: 1, scale: 1, rotate: 180 });
           setFx({ text: '🛑', left: midLeft, top: `calc(${midTop} - 5%)`, opacity: 1, className: 'anim-pop' });
        }, 250);
        
        schedule(() => {
           if (actorId) setActorOverride({ id: actorId, scale: 1, zIndex: 20 });
        }, 600);
      }
      else if (type === 'CLEARANCE') {
        setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, scale: 1.3, rotate: 15 });
        
        schedule(() => {
          const clearY = `calc(${aTop} + ${isHomeActor ? '-25%' : '25%'})`;
          setBall({ left: aLeft, top: clearY, opacity: 1, scale: 3.5, rotate: 1080, boxShadow: '0 30px 40px rgba(0,0,0,0.6)', zIndex: 50 });
          if (actorId) setActorOverride({ id: actorId, scale: 1, rotate: 0 });
        }, 250);
        
        schedule(() => {
          const finalY = `calc(${aTop} + ${isHomeActor ? '-50%' : '50%'})`;
          setBall({ left: '50%', top: finalY, opacity: 1, scale: 1, rotate: 2160, boxShadow: 'none' });
        }, 700);
      }
      else if (type === 'BLOCK') {
        setBall({ left: tLeft, top: tTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop });
        
        schedule(() => {
           setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
           if (actorId) setActorOverride({ id: actorId, scale: 1.3, rotate: 15 }); 
           setFx({ text: '🛡️', left: aLeft, top: `calc(${aTop} - 5%)`, opacity: 1, className: 'anim-pop' });
        }, 200);
        
        schedule(() => {
           const ricochetY = `calc(${aTop} + ${isHomeActor ? '25%' : '-25%'})`;
           setBall({ left: `calc(${aLeft} + 25%)`, top: ricochetY, opacity: 1, scale: 1.5, rotate: 720 }); 
           if (actorId) setActorOverride({ id: actorId, scale: 1, rotate: 0 });
        }, 500);
      }
      else if (type === 'SAVE') {
        setBall({ left: tLeft, top: tTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop });
        
        schedule(() => {
          setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
          if (actorId) setActorOverride({ id: actorId, rotate: -90, scale: 1.4, zIndex: 40 }); 
          setFx({ text: '🧤', left: aLeft, top: `calc(${aTop} - 5%)`, opacity: 1, className: 'anim-pop' });
        }, 250);
        
        schedule(() => {
          const deflectY = `calc(${aTop} + ${isHomeActor ? '-15%' : '15%'})`;
          setBall({ left: `calc(${aLeft} - 25%)`, top: deflectY, opacity: 1, scale: 1.5, rotate: 540 });
          if (actorId) setActorOverride({ id: actorId, rotate: 0, scale: 1, zIndex: 20 }); 
        }, 700);
      }
      else if (type === 'AERIAL_DUEL' || type === 'AERIAL_CLAIM') {
        setBall({ left: midLeft, top: midTop, opacity: 1, scale: 3, boxShadow: '0 20px 25px rgba(0,0,0,0.4)', zIndex: 30 }); 
        if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop });
        if (targetId) setTargetOverride({ id: targetId, left: tLeft, top: tTop });
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, left: `calc(${midLeft} - 2%)`, top: midTop, scale: 1.6, zIndex: 40 });
          if (targetId) setTargetOverride({ id: targetId, left: `calc(${midLeft} + 2%)`, top: midTop, scale: 1.6, zIndex: 40 });
          setFx({ text: '💥', left: midLeft, top: midTop, opacity: 1, className: 'anim-pop' });
        }, 300);
        
        schedule(() => {
          setBall({ left: midLeft, top: `calc(${midTop} + 10%)`, opacity: 1, scale: 1, boxShadow: 'none' });
          if (actorId) setActorOverride({ id: actorId, scale: 1, zIndex: 20 });
          if (targetId) setTargetOverride({ id: targetId, scale: 1, zIndex: 20 });
        }, 700);
      }
      else if (type === 'FOUL') {
        if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop });
        if (targetId) setTargetOverride({ id: targetId, left: tLeft, top: tTop });
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, left: tLeft, top: tTop, scale: 1.3, rotate: 20 }); 
          if (targetId) setTargetOverride({ id: targetId, rotate: -90, scale: 0.9, opacity: 0.8 }); 
          setFx({ text: '⚡', left: tLeft, top: tTop, opacity: 1, scale: 1.5, className: 'anim-pop' });
        }, 200);
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop, scale: 1, rotate: 0 }); 
        }, 700);
      }
      else if (type === 'YELLOW_CARD') {
        if (actorId) setActorOverride({ id: actorId, scale: 1.3 });
        setFx({ text: '🟨', left: aLeft, top: `calc(${aTop} - 8%)`, opacity: 1, scale: 1.5, className: 'anim-pop drop-shadow-md' });
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, scale: 1 });
        }, 800);
      }
      else if (type === 'RED_CARD') {
        if (actorId) setActorOverride({ id: actorId, scale: 1.3 });
        setFx({ text: '🟥', left: aLeft, top: `calc(${aTop} - 8%)`, opacity: 1, scale: 1.5, className: 'anim-pop drop-shadow-md' });
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, opacity: 0, scale: 0.5, rotate: 90 });
        }, 800);
      }
      else if (type === 'FREE_KICK') {
        setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, left: `calc(${aLeft} + 5%)`, top: `calc(${aTop} + 5%)` }); 
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop, scale: 1.3, rotate: -15 }); 
        }, 400);
        
        schedule(() => {
          if (targetId) {
             setBall({ left: tLeft, top: tTop, opacity: 1, scale: 1, rotate: 720 });
             if (targetId) setTargetOverride({ id: targetId, scale: 1.3 });
          } else {
             setBall({ left: '50%', top: goalY, opacity: 1, scale: 1, rotate: 1080 }); 
          }
          if (actorId) setActorOverride({ id: actorId, scale: 1, rotate: 0 });
        }, 700);
        schedule(() => {
          if (targetId) setTargetOverride({ id: targetId, scale: 1 });
        }, 1000);
      }
      else if (type === 'CORNER') {
        const cornerX = '0%'; 
        const cornerY = goalY;
        
        setBall({ left: cornerX, top: cornerY, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, top: cornerY, left: `calc(${cornerX} + 5%)` });
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, top: cornerY, left: cornerX, scale: 1.2 });
        }, 200);
        
        schedule(() => {
          setBall({ left: '30%', top: `calc(${goalY} + ${isHomeActor ? '20%' : '-20%'})`, opacity: 1, scale: 3.5, rotate: 360, boxShadow: '0 30px 40px rgba(0,0,0,0.6)', zIndex: 40 });
          if (actorId) setActorOverride({ id: actorId, scale: 1 });
        }, 500);
        
        schedule(() => {
          if (targetId) {
             setBall({ left: tLeft, top: tTop, opacity: 1, scale: 1, rotate: 720, boxShadow: 'none', zIndex: 20 });
             if (targetId) setTargetOverride({ id: targetId, scale: 1.4, zIndex: 30 });
          } else {
             setBall({ left: '50%', top: `calc(${goalY} + ${isHomeActor ? '10%' : '-10%'})`, opacity: 1, scale: 1, rotate: 720, boxShadow: 'none', zIndex: 20 }); 
          }
        }, 900);
        
        schedule(() => {
          if (targetId) setTargetOverride({ id: targetId, scale: 1, zIndex: 20 });
        }, 1300);
      }
      else if (type === 'BALL_RECOVERY') {
        const looseX = `calc(${aLeft} + 10%)`;
        const looseY = `calc(${aTop} + 10%)`;
        setBall({ left: looseX, top: looseY, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop });
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, left: looseX, top: looseY, scale: 1.2, rotate: 10 });
          setBall({ left: looseX, top: looseY, opacity: 1, scale: 1.2 });
          setFx({ text: '✨', left: looseX, top: `calc(${looseY} - 5%)`, opacity: 1, className: 'anim-pop' });
        }, 250);
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, scale: 1, rotate: 0 });
          setBall({ left: looseX, top: looseY, opacity: 1, scale: 1 });
        }, 600);
      }
      else if (type === 'GREAT_FIRST_TOUCH') {
        setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop, scale: 1.5, zIndex: 40 }); 
        setFx({ text: '⭐', left: aLeft, top: `calc(${aTop} - 5%)`, opacity: 1, scale: 1.5, className: 'anim-pop' });
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop, scale: 1, zIndex: 20 });
        }, 500);
      }
      else if (type === 'SWEEPER_ACTION') {
        setBall({ left: aLeft, top: `calc(${aTop} + ${isHomeActor ? '-35%' : '35%'})`, opacity: 1, scale: 1 }); 
        if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop }); 
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, left: aLeft, top: `calc(${aTop} + ${isHomeActor ? '-35%' : '35%'})`, scale: 1.3, rotate: -15 });
          setFx({ text: '💨', left: aLeft, top: `calc(${aTop} + ${isHomeActor ? '-15%' : '15%'})`, opacity: 1, className: 'anim-pop' });
        }, 250);
        
        schedule(() => {
          if (actorId) setActorOverride({ id: actorId, scale: 1, rotate: 0 });
        }, 700);
      }
      else if (type === 'ERROR') {
        setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
        if (actorId) setActorOverride({ id: actorId, left: aLeft, top: aTop, rotate: 360 }); 
        setFx({ text: '❓', left: aLeft, top: `calc(${aTop} - 8%)`, opacity: 1, scale: 1.5, className: 'anim-pop' });
        
        schedule(() => {
          setBall({ left: `calc(${aLeft} - 25%)`, top: `calc(${aTop} - 15%)`, opacity: 1, scale: 1, rotate: 180 });
          if (actorId) setActorOverride({ id: actorId, rotate: 0 });
        }, 400);
      }
      else if (type === 'DROP_BALL') {
        setBall({ left: aLeft, top: aTop, opacity: 1, scale: 3.5, boxShadow: '0 30px 40px rgba(0,0,0,0.6)', zIndex: 40 });
        
        schedule(() => {
           setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1, boxShadow: 'none', zIndex: 20 });
           setFx({ text: '💨', left: aLeft, top: `calc(${aTop} + 5%)`, opacity: 1, className: 'anim-pop' });
        }, 300);
        
        schedule(() => {
           setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1.6 });
        }, 450);
        
        schedule(() => {
           setBall({ left: aLeft, top: aTop, opacity: 1, scale: 1 });
        }, 600);
      }
      else if (type === 'INJURY_NOTE') {
        if (actorId) setActorOverride({ id: actorId, rotate: -90, scale: 0.8, opacity: 0.7 }); 
        setFx({ text: '🚑', left: aLeft, top: `calc(${aTop} - 5%)`, opacity: 1, scale: 1.5, className: 'anim-pop' });
      }
      else {
        setFx({ text: '⭐', left: aLeft, top: aTop, opacity: 1, className: 'anim-pop' });
      }
    }, 50);


    return () => timers.current.forEach(clearTimeout);
  }, [activeEvent]);


  // Calculate geometric positions
  const homePositions = getGeometricPositions(localHomeStarters.length, true, possession);
  const awayPositions = getGeometricPositions(localAwayStarters.length, false, possession);

  const renderPlayer = (p: any, idx: number, isHome: boolean, positions: {x:string, y:string}[]) => {
    let styleLeft = positions[idx]?.x || '50%';
    let styleTop = positions[idx]?.y || '50%';
    let styleOpacity = 1;

    let styleScale = 1;
    let styleRotate = 0;

        if (actorOverride?.id === p.id) {
      if (actorOverride.left) styleLeft = actorOverride.left;
      if (actorOverride.top) styleTop = actorOverride.top;
      if (actorOverride.opacity !== undefined) styleOpacity = actorOverride.opacity;
      if (actorOverride.scale !== undefined) styleScale = actorOverride.scale;
      if (actorOverride.rotate !== undefined) styleRotate = actorOverride.rotate;
    }
    
    if (targetOverride?.id === p.id) {
      if (targetOverride.left) styleLeft = targetOverride.left;
      if (targetOverride.top) styleTop = targetOverride.top;
      if (targetOverride.opacity !== undefined) styleOpacity = targetOverride.opacity;
      if (targetOverride.scale !== undefined) styleScale = targetOverride.scale;
      if (targetOverride.rotate !== undefined) styleRotate = targetOverride.rotate;
    }

    if (activeEvent && actorOverride?.id !== p.id && targetOverride?.id !== p.id) {
       styleTop = `calc(${styleTop} + ${isHome ? '-1%' : '1%'})`;
    }

    const seed = (idx + 1) * (isHome ? 1.5 : 2.3);
    const isOverridden = (actorOverride?.id === p.id) || (targetOverride?.id === p.id);

    return (
      <motion.div 
        key={p.id}
        initial={false}
        animate={{ 
          left: styleLeft, 
          top: styleTop, 
          opacity: styleOpacity,
          scale: styleScale,
          rotate: styleRotate,
          zIndex: (actorOverride?.id === p.id) ? (actorOverride.zIndex || 30) : ((targetOverride?.id === p.id) ? (targetOverride.zIndex || 30) : 10),
          x: isOverridden ? 0 : [0, (seed % 3) - 1, (seed % 4) - 2, 0],
          y: isOverridden ? 0 : [0, (seed % 5) - 2, (seed % 3) - 1, 0]
        }}
        transition={{ 
          left: { type: 'spring', stiffness: 100, damping: 14 },
          top: { type: 'spring', stiffness: 100, damping: 14 },
          opacity: { duration: 0.2 },
          scale: { type: 'spring', stiffness: 250, damping: 15 },
          rotate: { type: 'spring', stiffness: 200, damping: 20 },
          x: { duration: 4 + (seed % 2), repeat: Infinity, ease: 'easeInOut' },
          y: { duration: 3 + (seed % 3), repeat: Infinity, ease: 'easeInOut' }
        }}
        className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[10px] font-bold text-white ${isHome ? 'bg-blue-600' : 'bg-orange-500'}`}
      >
        {getInitials(p.name)}
      </motion.div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col justify-center items-center bg-[#121212] p-2">
      <style>{`
        .pitch-wrapper { display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; padding: 10px; }
        .pitch-container { background: #2E7D32; border: 2px solid white; position: relative; height: 100%; max-height: 500px; aspect-ratio: 2/3; border-radius: 8px; overflow: hidden; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .pitch-container::before { content: ''; position: absolute; top: 50%; left: 0; right: 0; border-top: 2px solid white; }
        .center-circle { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 35%; aspect-ratio: 1/1; border: 2px solid white; border-radius: 50%; }
        .penalty-area-top { position: absolute; top: 0; left: 20%; right: 20%; height: 16%; border: 2px solid white; border-top: none; }
        .penalty-area-bottom { position: absolute; bottom: 0; left: 20%; right: 20%; height: 16%; border: 2px solid white; border-bottom: none; }
        
        .fx { position:absolute; font-size: 32px; transform:translate(-50%, -50%); z-index: 30; pointer-events: none; white-space:nowrap; font-weight:900; color:yellow; -webkit-text-stroke: 1px black; }
        
        .bench-container { display: flex; justify-content: space-between; padding: 0 15px; margin-bottom: 5px; width: 100%; }
        .bench { display: flex; gap: 8px; background: #222; padding: 5px 10px; border-radius: 20px; align-items: center; overflow-x: auto; white-space: nowrap; }
        .bench::-webkit-scrollbar { display: none; }
        
        @keyframes shake { 0% {transform: translate(-50%, -50%) rotate(0deg);} 25% {transform: translate(-50%, -50%) rotate(-20deg);} 50% {transform: translate(-50%, -50%) rotate(20deg);} 75% {transform: translate(-50%, -50%) rotate(-10deg);} 100% {transform: translate(-50%, -50%) rotate(0deg);} }
        .anim-shake { animation: shake 0.4s ease-in-out; }
        
        @keyframes pop { 0% {transform: translate(-50%, -50%) scale(0.5); opacity:0} 50% {transform: translate(-50%, -50%) scale(1.5); opacity:1} 100% {transform: translate(-50%, -50%) scale(1); opacity:0} }
        .anim-pop { animation: pop 1s forwards; }
      `}</style>
      
      <div className="bench-container mt-2">
        <div className="bench text-white">
          <span style={{fontSize: '10px', color: '#aaa'}}>Home Subs</span>
          {localHomeSubs.map(p => (
            <div key={p.id} className="character home-team" style={{position: 'relative', transform: 'none'}}>🧍‍♂️<div className="char-label">{getInitials(p.name)}</div></div>
          ))}
          {localHomeSubs.length === 0 && <span style={{fontSize:'10px', color:'#555'}}>No Subs</span>}
        </div>
        <div className="bench text-white">
          {localAwaySubs.map(p => (
            <div key={p.id} className="character away-team" style={{position: 'relative', transform: 'none'}}>🧍‍♂️<div className="char-label">{getInitials(p.name)}</div></div>
          ))}
          {localAwaySubs.length === 0 && <span style={{fontSize:'10px', color:'#555'}}>No Subs</span>}
          <span style={{fontSize: '10px', color: '#aaa'}}>Away Subs</span>
        </div>
      </div>
      
      <div className="pitch-wrapper">
        <div className="pitch-container" id="pitch">
          <div className="center-circle"></div>
          <div className="penalty-area-top"></div>
          <div className="penalty-area-bottom"></div>
          
          {/* Render Starters */}
          {localHomeStarters.map((p, i) => renderPlayer(p, i, true, homePositions))}
          {localAwayStarters.map((p, i) => renderPlayer(p, i, false, awayPositions))}
          
          {/* Props */}
          <motion.div 
            className="absolute text-[16px] -ml-2 -mt-2 flex items-center justify-center"
            initial={false}
            animate={{ 
              left: ball.left, 
              top: ball.top, 
              opacity: ball.opacity, 
              scale: ball.scale || 1,
              rotate: ball.rotate || 0,
              boxShadow: ball.boxShadow || 'none',
              zIndex: ball.zIndex || 20
            }}
            transition={{ 
              left: { type: 'spring', stiffness: 90, damping: 12 },
              top: { type: 'spring', stiffness: 90, damping: 12 },
              scale: { type: 'spring', stiffness: 120, damping: 10 },
              rotate: { type: 'tween', duration: 0.3, ease: [0.16, 1, 0.3, 1] },
              boxShadow: { duration: 0.2 },
              opacity: { duration: 0.1 }
            }}
            style={{ borderRadius: '50%' }}
          >
            ⚽
          </motion.div>
          
          {fx && fx.opacity > 0 && (
            <div 
              className={`fx ${fx.className}`} 
              style={{ left: fx.left, top: fx.top, opacity: fx.opacity, transform: `translate(-50%, -50%) scale(${fx.scale || 1})` }}
            >
              {fx.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
