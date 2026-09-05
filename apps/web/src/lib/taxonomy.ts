import { TimelineEventType, MatchPeriod } from '@locofoot/shared-types';

export interface TaxonomyField {
  name: string;
  label: string;
  type: 'select' | 'radio' | 'boolean';
  options?: { value: string; label: string }[];
}

export interface EventTaxonomy {
  type: TimelineEventType;
  hasTarget?: boolean;
  targetLabel?: string;
  fields: TaxonomyField[];
}

export const eventTaxonomies: Record<string, EventTaxonomy> = {
  SHOT: {
    type: 'SHOT' as TimelineEventType,
    fields: [
      {
        name: 'result',
        label: 'Result',
        type: 'select',
        options: [
          { value: 'GOAL', label: 'Goal' },
          { value: 'SAVED', label: 'Saved' },
          { value: 'BLOCKED', label: 'Blocked' },
          { value: 'OFF_TARGET', label: 'Off Target' },
          { value: 'WOODWORK', label: 'Hit Woodwork' }
        ]
      },
      {
        name: 'bodyPart',
        label: 'Body Part',
        type: 'select',
        options: [
          { value: 'RIGHT_FOOT', label: 'Right Foot' },
          { value: 'LEFT_FOOT', label: 'Left Foot' },
          { value: 'HEAD', label: 'Head' },
          { value: 'OTHER', label: 'Other (Chest, Heel, etc.)' }
        ]
      },
      {
        name: 'location',
        label: 'Location',
        type: 'select',
        options: [
          { value: 'INSIDE_6YD', label: 'Inside 6-yard box' },
          { value: 'PENALTY_AREA', label: 'Penalty area' },
          { value: 'OUTSIDE_BOX', label: 'Outside box' },
          { value: 'HALF_WAY', label: 'Half-way line' }
        ]
      },
      {
        name: 'type',
        label: 'Shot Type',
        type: 'select',
        options: [
          { value: 'PLACED', label: 'Placed' },
          { value: 'DRIVEN', label: 'Power/Driven' },
          { value: 'VOLLEY', label: 'Volley' },
          { value: 'HALF_VOLLEY', label: 'Half-volley' },
          { value: 'BICYCLE', label: 'Bicycle kick' },
          { value: 'CHIP', label: 'Chip/Lob' },
          { value: 'TAP_IN', label: 'Tap-in' }
        ]
      },
      {
        name: 'situation',
        label: 'Situation',
        type: 'select',
        options: [
          { value: 'OPEN_PLAY', label: 'Open Play' },
          { value: 'COUNTER_ATTACK', label: 'Counter Attack' },
          { value: 'SET_PIECE', label: 'Set Piece' },
          { value: 'PENALTY', label: 'Penalty' },
          { value: 'FREE_KICK', label: 'Direct Free Kick' }
        ]
      }
    ]
  },
  PASS: {
    type: 'PASS' as TimelineEventType,
    hasTarget: true,
    targetLabel: 'Pass Recipient',
    fields: [
      {
        name: 'result',
        label: 'Result',
        type: 'radio',
        options: [
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'INTERCEPTED', label: 'Intercepted' },
          { value: 'BLOCKED', label: 'Blocked' },
          { value: 'OUT_OF_BOUNDS', label: 'Out of Bounds' }
        ]
      },
      {
        name: 'distance',
        label: 'Distance',
        type: 'select',
        options: [
          { value: 'SHORT', label: 'Short (0-15m)' },
          { value: 'MEDIUM', label: 'Medium (15-30m)' },
          { value: 'LONG', label: 'Long (30m+)' }
        ]
      },
      {
        name: 'type',
        label: 'Pass Type',
        type: 'select',
        options: [
          { value: 'GROUND', label: 'Ground' },
          { value: 'LOFTED', label: 'Lofted/Chipped' },
          { value: 'THROUGH_BALL', label: 'Through ball' },
          { value: 'SWITCH', label: 'Switch of play' },
          { value: 'LAYOFF', label: 'Lay-off' }
        ]
      },
      {
        name: 'qualifier',
        label: 'Special Qualifier',
        type: 'select',
        options: [
          { value: 'NONE', label: 'None' },
          { value: 'KEY_PASS', label: 'Key Pass (led to shot)' },
          { value: 'ASSIST', label: 'Assist (led to goal)' }
        ]
      }
    ]
  },
  DRIBBLE: {
    type: 'DRIBBLE' as TimelineEventType,
    fields: [
      {
        name: 'result',
        label: 'Result',
        type: 'radio',
        options: [
          { value: 'SUCCESS', label: 'Successful' },
          { value: 'UNSUCCESSFUL', label: 'Unsuccessful (dispossessed)' }
        ]
      },
      {
        name: 'skillType',
        label: 'Type of Skill',
        type: 'select',
        options: [
          { value: 'STEPOVER', label: 'Stepover' },
          { value: 'BODY_FEINT', label: 'Body Feint' },
          { value: 'NUTMEG', label: 'Nutmeg' },
          { value: 'ROULETTE', label: 'Roulette' },
          { value: 'ELASTICO', label: 'Elastico' },
          { value: 'RAINBOW', label: 'Rainbow Flick' },
          { value: 'SPEED_BURST', label: 'Speed burst/Knock-on' },
          { value: 'FAKE_SHOT', label: 'Fake shot' }
        ]
      },
      {
        name: 'opponentsBeaten',
        label: 'Opponents Beaten',
        type: 'select',
        options: [
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3+', label: '3+' }
        ]
      }
    ]
  },
  CROSS: {
    type: 'CROSS' as TimelineEventType,
    hasTarget: true,
    targetLabel: 'Cross Target',
    fields: [
      {
        name: 'result',
        label: 'Result',
        type: 'select',
        options: [
          { value: 'COMPLETED', label: 'Reached teammate' },
          { value: 'CLEARED', label: 'Cleared by defender' },
          { value: 'CAUGHT', label: 'Caught by keeper' },
          { value: 'OUT', label: 'Out of play' }
        ]
      },
      {
        name: 'trajectory',
        label: 'Trajectory',
        type: 'select',
        options: [
          { value: 'FLOATED', label: 'Floated' },
          { value: 'DRIVEN', label: 'Driven/Whipped' },
          { value: 'CUTBACK', label: 'Cutback' },
          { value: 'GROUND', label: 'Ground cross' }
        ]
      },
      {
        name: 'curl',
        label: 'Curl',
        type: 'select',
        options: [
          { value: 'INSWINGING', label: 'Inswinging' },
          { value: 'OUTSWINGING', label: 'Outswinging' },
          { value: 'STRAIGHT', label: 'Straight' }
        ]
      }
    ]
  },
  TACKLE: {
    type: 'TACKLE' as TimelineEventType,
    hasTarget: true,
    targetLabel: 'Tackled Player',
    fields: [
      {
        name: 'result',
        label: 'Result',
        type: 'select',
        options: [
          { value: 'WON_RETAINED', label: 'Won (retained possession)' },
          { value: 'WON_LOOSE', label: 'Won (ball loose/out)' },
          { value: 'LOST', label: 'Lost (dribbled past)' },
          { value: 'FOUL', label: 'Foul committed' }
        ]
      },
      {
        name: 'type',
        label: 'Type',
        type: 'radio',
        options: [
          { value: 'STANDING', label: 'Standing' },
          { value: 'SLIDING', label: 'Sliding' }
        ]
      },
      {
        name: 'position',
        label: 'Positioning',
        type: 'select',
        options: [
          { value: 'FRONT', label: 'From front' },
          { value: 'SIDE', label: 'From side' },
          { value: 'BEHIND', label: 'From behind' }
        ]
      }
    ]
  },
  SAVE: {
    type: 'SAVE' as TimelineEventType,
    fields: [
      {
        name: 'type',
        label: 'Save Type',
        type: 'select',
        options: [
          { value: 'CATCH', label: 'Catch/Hold' },
          { value: 'PARRY_SAFE', label: 'Parry to safety' },
          { value: 'PARRY_DANGER', label: 'Parry into danger' },
          { value: 'FINGERTIP', label: 'Fingertip' }
        ]
      },
      {
        name: 'bodyPart',
        label: 'Body Part',
        type: 'select',
        options: [
          { value: 'HANDS', label: 'Hands' },
          { value: 'FEET', label: 'Feet' },
          { value: 'BODY', label: 'Face/Body' }
        ]
      },
      {
        name: 'context',
        label: 'Context',
        type: 'select',
        options: [
          { value: '1V1', label: '1v1 situation' },
          { value: 'REFLEX', label: 'Reflex save' },
          { value: 'LONG_SHOT', label: 'Long-shot save' },
          { value: 'PENALTY', label: 'Penalty save' }
        ]
      }
    ]
  },
  BALL_RECOVERY: {
    type: 'BALL_RECOVERY' as TimelineEventType,
    fields: [
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'INTERCEPTION', label: 'Interception (reading pass)' },
          { value: 'RECOVERY', label: 'Ball recovery (loose ball)' },
          { value: 'CLEARANCE', label: 'Clearance' },
          { value: 'BLOCK', label: 'Block' }
        ]
      }
    ]
  }
};
