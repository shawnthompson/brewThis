import { BrewfatherRecipe } from '@/types';

/**
 * Sample recipes for demonstration purposes when personal Brewfather recipes are not available
 * These are based on common brewing recipes and styles
 */
export const sampleRecipes: BrewfatherRecipe[] = [
  {
    _id: 'sample-ipa-001',
    name: 'Classic American IPA',
    style: {
      name: 'American IPA',
      category: 'IPA',
      styleGuide: 'BJCP',
      styleLetter: 'A',
      categoryNumber: 21
    },
    author: 'Sample Recipe Collection',
    type: 'All Grain',
    abv: 6.2,
    ibu: 58,
    og: 1.062,
    fg: 1.012,
    color: 8,
    batchSize: 20,
    boilTime: 60,
    efficiency: 75,
    notes: 'A classic American IPA with citrus and pine hop character. Uses Cascade, Centennial, and Amarillo hops.',
    fermentables: [
      {
        name: 'Pale Ale Malt',
        amount: 5.5,
        color: 3,
        percentage: 85,
        type: 'Grain'
      },
      {
        name: 'Crystal 60L',
        amount: 0.5,
        color: 60,
        percentage: 8,
        type: 'Grain'
      },
      {
        name: 'Munich Malt',
        amount: 0.45,
        color: 9,
        percentage: 7,
        type: 'Grain'
      }
    ],
    hops: [
      {
        name: 'Cascade',
        amount: 30,
        time: 60,
        use: 'Boil',
        alpha: 5.5,
        type: 'Pellet'
      },
      {
        name: 'Centennial',
        amount: 25,
        time: 15,
        use: 'Boil',
        alpha: 10,
        type: 'Pellet'
      },
      {
        name: 'Amarillo',
        amount: 20,
        time: 0,
        use: 'Aroma',
        alpha: 8.6,
        type: 'Pellet'
      }
    ],
    yeasts: [
      {
        name: 'Safale US-05',
        amount: 11,
        type: 'Ale',
        form: 'Dry',
        attenuation: 81
      }
    ]
  },
  {
    _id: 'sample-stout-001',
    name: 'Imperial Stout',
    style: {
      name: 'Imperial Stout',
      category: 'Stout',
      styleGuide: 'BJCP',
      styleLetter: 'C',
      categoryNumber: 20
    },
    author: 'Sample Recipe Collection',
    type: 'All Grain',
    abv: 9.2,
    ibu: 65,
    og: 1.085,
    fg: 1.018,
    color: 45,
    batchSize: 20,
    boilTime: 90,
    efficiency: 72,
    notes: 'Rich, complex imperial stout with chocolate and coffee notes. Perfect for cold nights.',
    fermentables: [
      {
        name: 'Maris Otter',
        amount: 7,
        color: 3,
        percentage: 70,
        type: 'Grain'
      },
      {
        name: 'Chocolate Malt',
        amount: 0.8,
        color: 350,
        percentage: 8,
        type: 'Grain'
      },
      {
        name: 'Roasted Barley',
        amount: 0.6,
        color: 300,
        percentage: 6,
        type: 'Grain'
      },
      {
        name: 'Crystal 120L',
        amount: 0.8,
        color: 120,
        percentage: 8,
        type: 'Grain'
      },
      {
        name: 'Flaked Oats',
        amount: 0.8,
        color: 2,
        percentage: 8,
        type: 'Adjunct'
      }
    ],
    hops: [
      {
        name: 'Northern Brewer',
        amount: 45,
        time: 90,
        use: 'Boil',
        alpha: 8.5,
        type: 'Pellet'
      },
      {
        name: 'East Kent Goldings',
        amount: 20,
        time: 15,
        use: 'Boil',
        alpha: 5,
        type: 'Pellet'
      }
    ],
    yeasts: [
      {
        name: 'Wyeast 1056',
        amount: 200,
        type: 'Ale',
        form: 'Liquid',
        attenuation: 75
      }
    ]
  },
  {
    _id: 'sample-wheat-001',
    name: 'Bavarian Hefeweizen',
    style: {
      name: 'Weissbier',
      category: 'Wheat Beer',
      styleGuide: 'BJCP',
      styleLetter: 'A',
      categoryNumber: 10
    },
    author: 'Sample Recipe Collection',
    type: 'All Grain',
    abv: 5.4,
    ibu: 15,
    og: 1.052,
    fg: 1.010,
    color: 4,
    batchSize: 20,
    boilTime: 60,
    efficiency: 78,
    notes: 'Traditional German wheat beer with banana and clove esters. Serve with lemon wedge.',
    fermentables: [
      {
        name: 'Wheat Malt',
        amount: 2.8,
        color: 2,
        percentage: 60,
        type: 'Grain'
      },
      {
        name: 'Pilsner Malt',
        amount: 1.85,
        color: 2,
        percentage: 40,
        type: 'Grain'
      }
    ],
    hops: [
      {
        name: 'Hallertauer Mittelfrüh',
        amount: 20,
        time: 60,
        use: 'Boil',
        alpha: 3.5,
        type: 'Pellet'
      }
    ],
    yeasts: [
      {
        name: 'Wyeast 3068',
        amount: 150,
        type: 'Ale',
        form: 'Liquid',
        attenuation: 77
      }
    ]
  },
  {
    _id: 'sample-pale-001',
    name: 'English Bitter',
    style: {
      name: 'Best Bitter',
      category: 'Pale Ale',
      styleGuide: 'BJCP',
      styleLetter: 'B',
      categoryNumber: 11
    },
    author: 'Sample Recipe Collection',
    type: 'All Grain',
    abv: 4.8,
    ibu: 32,
    og: 1.046,
    fg: 1.008,
    color: 12,
    batchSize: 20,
    boilTime: 60,
    efficiency: 75,
    notes: 'Traditional English bitter with earthy, floral hop character and rich malt backbone.',
    fermentables: [
      {
        name: 'Maris Otter',
        amount: 4.2,
        color: 3,
        percentage: 90,
        type: 'Grain'
      },
      {
        name: 'Crystal 60L',
        amount: 0.35,
        color: 60,
        percentage: 7.5,
        type: 'Grain'
      },
      {
        name: 'Biscuit Malt',
        amount: 0.12,
        color: 23,
        percentage: 2.5,
        type: 'Grain'
      }
    ],
    hops: [
      {
        name: 'East Kent Goldings',
        amount: 25,
        time: 60,
        use: 'Boil',
        alpha: 5,
        type: 'Pellet'
      },
      {
        name: 'Fuggles',
        amount: 15,
        time: 15,
        use: 'Boil',
        alpha: 4.5,
        type: 'Pellet'
      }
    ],
    yeasts: [
      {
        name: 'Wyeast 1968',
        amount: 120,
        type: 'Ale',
        form: 'Liquid',
        attenuation: 67
      }
    ]
  },
  {
    _id: 'sample-lager-001',
    name: 'Czech Pilsner',
    style: {
      name: 'Czech Premium Pale Lager',
      category: 'Pale Lager',
      styleGuide: 'BJCP',
      styleLetter: 'A',
      categoryNumber: 3
    },
    author: 'Sample Recipe Collection',
    type: 'All Grain',
    abv: 4.6,
    ibu: 38,
    og: 1.044,
    fg: 1.008,
    color: 4,
    batchSize: 20,
    boilTime: 90,
    efficiency: 75,
    notes: 'Classic Bohemian pilsner with spicy Saaz hops and soft water character.',
    fermentables: [
      {
        name: 'Pilsner Malt',
        amount: 4.1,
        color: 2,
        percentage: 100,
        type: 'Grain'
      }
    ],
    hops: [
      {
        name: 'Saaz',
        amount: 35,
        time: 60,
        use: 'Boil',
        alpha: 3.5,
        type: 'Pellet'
      },
      {
        name: 'Saaz',
        amount: 20,
        time: 30,
        use: 'Boil',
        alpha: 3.5,
        type: 'Pellet'
      },
      {
        name: 'Saaz',
        amount: 15,
        time: 5,
        use: 'Boil',
        alpha: 3.5,
        type: 'Pellet'
      }
    ],
    yeasts: [
      {
        name: 'Saflager W-34/70',
        amount: 11,
        type: 'Lager',
        form: 'Dry',
        attenuation: 83
      }
    ]
  }
];

/**
 * Search sample recipes by query
 */
export function searchSampleRecipes(query: string): BrewfatherRecipe[] {
  if (!query.trim()) {
    return sampleRecipes;
  }

  const searchTerm = query.toLowerCase();
  
  return sampleRecipes.filter(recipe => 
    recipe.name.toLowerCase().includes(searchTerm) ||
    recipe.style?.name?.toLowerCase().includes(searchTerm) ||
    recipe.style?.category?.toLowerCase().includes(searchTerm) ||
    recipe.notes?.toLowerCase().includes(searchTerm) ||
    recipe.fermentables?.some(fermentable => 
      fermentable.name?.toLowerCase().includes(searchTerm)
    ) ||
    recipe.hops?.some(hop => 
      hop.name?.toLowerCase().includes(searchTerm)
    )
  );
}