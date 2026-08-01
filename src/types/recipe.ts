export interface SRSItem {
  id: string;
  level: number;
  nextReview: number;
}

export interface StandardSteps {
  steamMilk: string;
  queueShots: string;
  pumpSyrup: string;
  finish: string;
}

export interface Recipe {
  id: string;
  name: string;
  code?: string;
  type: 'hot' | 'iced';
  steps: StandardSteps;
  srs?: SRSItem;
}

export interface EvaluationResult {
  isCorrect: boolean;
  score: number;
  feedback: string[];
}

export interface Settings {
  difficulty: 'easy' | 'medium' | 'hard';
  audioEnabled: boolean;
}
