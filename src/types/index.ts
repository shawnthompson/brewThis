// Brewfather API types
export interface BrewfatherRecipe {
  _id: string;
  name: string;
  type?: string; // Recipe type (e.g., "All Grain", "Extract", "Partial Mash")
  style?: {
    name: string;
    categoryNumber?: string | number;
    styleLetter?: string;
    category?: string;
    styleGuide?: string;
  };
  abv?: number;
  ibu?: number;
  og?: number;
  fg?: number;
  color?: number;
  attenuation?: number;
  batchSize?: number;
  boilTime?: number;
  efficiency?: number;
  author?: string;
  created?: string;
  updated?: string;
  _created?: { _seconds: number }; // Brewfather timestamp format
  description?: string;
  notes?: string;
  tags?: string[];
  public?: boolean;
  
  // Ingredients
  fermentables?: BrewfatherFermentable[];
  hops?: BrewfatherHop[];
  yeasts?: BrewfatherYeast[];
  miscs?: BrewfatherMisc[];
  
  // Process
  mash?: BrewfatherMash;
  fermentation?: BrewfatherFermentation;
  water?: BrewfatherWater;
  equipment?: BrewfatherEquipment;
}

export interface BrewfatherEquipment {
  name?: string;
  spargeTemperature?: number;
}

export interface BrewfatherFermentable {
  _id?: string;
  name: string;
  origin?: string;
  type?: string;
  color?: number;
  potential?: number;
  amount?: number;
  percentage?: number;
  grainCategory?: string;
  supplier?: string;
  addAfterBoil?: boolean;
  notFermentable?: boolean;
}

export interface BrewfatherHop {
  _id?: string;
  name: string;
  origin?: string;
  type?: string;
  alpha?: number;
  beta?: number;
  amount?: number;
  use?: string;
  time?: number;
  temp?: number;
  ibu?: number;
  actualTime?: number;
  day?: number; // dry hop day
}

export interface BrewfatherYeast {
  _id?: string;
  name: string;
  laboratory?: string;
  productId?: string;
  type?: string;
  form?: string;
  attenuation?: number;
  minTemp?: number;
  maxTemp?: number;
  amount?: number;
  unit?: string;
}

export interface BrewfatherMisc {
  _id: string;
  name: string;
  type?: string;
  use?: string;
  time?: number;
  amount?: number;
  unit?: string;
}

export interface BrewfatherMash {
  name?: string;
  ph?: number;
  steps?: BrewfatherMashStep[];
}

export interface BrewfatherMashStep {
  name?: string;
  type?: string;
  temp?: number;
  time?: number;
  stepTemp?: number;
  stepTime?: number;
  rampTime?: number;
}

export interface BrewfatherFermentation {
  name?: string;
  steps?: BrewfatherFermentationStep[];
}

export interface BrewfatherFermentationStep {
  name?: string;
  type?: string;
  temp?: number;
  time?: number;
  stepTemp?: number;
  stepTime?: number; // days
  pressure?: number;
}

export interface BrewfatherWater {
  source?: Record<string, unknown>;
  target?: Record<string, unknown>;
  mash?: Record<string, unknown>;
  sparge?: Record<string, unknown>;
  total?: Record<string, unknown>;
}

// Local app types
export interface Recipe {
  id: number;
  brewfatherId?: string;
  name: string;
  style?: string;
  description?: string;
  abv?: number;
  ibu?: number;
  originalGravity?: number;
  finalGravity?: number;
  color?: number;
  batchSize?: number;
  boilTime?: number;
  efficiency?: number;
  isPublic: boolean;
  userId?: number;
  createdAt: Date;
  updatedAt: Date;
  ingredients?: Record<string, unknown>;
  mashProfile?: Record<string, unknown>;
  fermentation?: Record<string, unknown>;
  notes?: string;
}

export interface SearchFilters {
  style?: string;
  minAbv?: number;
  maxAbv?: number;
  difficulty?: string;
  page: number;
  limit: number;
  sortBy?: 'name' | 'abv' | 'ibu' | 'created' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  recipes: BrewfatherRecipe[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Brewfather Batch types
export interface BrewfatherBatch {
  _id: string;
  name: string;
  recipe?: BrewfatherRecipe;
  recipeId?: string;
  batchNo?: number;
  status?: string;
  brewer?: string;
  brewDate?: string;
  fermentationStartDate?: string;
  fermentationEndDate?: string;
  bottlingDate?: string;
  measuredOg?: number;
  measuredFg?: number;
  measuredAbv?: number;
  notes?: string;
  batchNotes?: string;
  _created?: { _seconds: number };
  _timestamp_ms?: number;
  estimatedOg?: number;
  estimatedFg?: number;
  estimatedAbv?: number;
  estimatedIbu?: number;
}

// Component props types
export interface RecipeCardProps {
  recipe: BrewfatherRecipe;
  onSelect?: (recipe: BrewfatherRecipe) => void;
  onImport?: (recipe: BrewfatherRecipe) => void;
  className?: string;
}

export interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  isLoading?: boolean;
  initialQuery?: string;
  className?: string;
}

export interface NavigationProps {
  currentPage?: string;
  className?: string;
}

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Brewing process types (for future features)
export interface BrewingSession {
  id: number;
  recipeId: number;
  userId: number;
  brewDate: Date;
  batchNumber?: string;
  status: 'planned' | 'brewing' | 'fermenting' | 'conditioning' | 'completed';
  notes?: string;
  actualOg?: number;
  actualFg?: number;
  actualAbv?: number;
  actualIbu?: number;
  brewStartTime?: Date;
  brewEndTime?: Date;
  fermentStart?: Date;
  fermentEnd?: Date;
  packagingDate?: Date;
}

export interface FermentationLog {
  id: number;
  brewingSessionId: number;
  timestamp: Date;
  temperature?: number;
  gravity?: number;
  ph?: number;
  pressure?: number;
  source: 'RAPT' | 'TILT' | 'MANUAL';
  deviceId?: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: 'grain' | 'hops' | 'yeast' | 'other';
  type?: string;
  amount: number;
  unit: string;
  supplier?: string;
  lotNumber?: string;
  expiryDate?: Date;
  cost?: number;
  notes?: string;
  userId: number;
}