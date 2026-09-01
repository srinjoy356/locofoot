class PlayerStatsResponse(BaseModel):  
    event_player_id: UUID  
    goals: int  
    assists: int  
    matches_played: int 
