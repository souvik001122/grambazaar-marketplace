export const CATEGORIES = [
  {
    id: 'pottery',
    name: 'Pottery & Ceramics',
    icon: '🏺',
    description: 'Traditional clay works and pottery'
  },
  {
    id: 'textiles',
    name: 'Textiles & Fabrics',
    icon: '🧵',
    description: 'Handwoven fabrics, sarees, and textiles'
  },
  {
    id: 'handicrafts',
    name: 'Handicrafts',
    icon: '🎨',
    description: 'Handmade crafts and decorative items'
  },
  {
    id: 'jewelry',
    name: 'Jewelry & Accessories',
    icon: '💍',
    description: 'Traditional jewelry and accessories'
  },
  {
    id: 'woodwork',
    name: 'Wood Work',
    icon: '🪵',
    description: 'Carved wooden items and furniture'
  },
  {
    id: 'metalwork',
    name: 'Metal Work',
    icon: '⚒️',
    description: 'Brass, copper, and metal crafts'
  },
  {
    id: 'paintings',
    name: 'Paintings & Art',
    icon: '🖼️',
    description: 'Traditional paintings and artwork'
  },
  {
    id: 'food',
    name: 'Food Products',
    icon: '🍯',
    description: 'Traditional food items and spices'
  },
  {
    id: 'leather',
    name: 'Leather Goods',
    icon: '👜',
    description: 'Handmade leather products'
  },
  {
    id: 'bamboo',
    name: 'Bamboo & Cane',
    icon: '🎋',
    description: 'Bamboo and cane products'
  },
  {
    id: 'stone',
    name: 'Stone Carving',
    icon: '🗿',
    description: 'Carved stone items'
  },
  {
    id: 'other',
    name: 'Other',
    icon: '✨',
    description: 'Other traditional crafts'
  }
];

export const getCategoryById = (id: string) => {
  return CATEGORIES.find(cat => cat.id === id);
};

export const getCategoryName = (id: string) => {
  return CATEGORIES.find(cat => cat.id === id)?.name || 'Unknown';
};

// Craft types for seller onboarding
export const CRAFT_TYPES = [
  'Pottery & Ceramics',
  'Textiles & Fabrics',
  'Handicrafts',
  'Jewelry',
  'Wood Work',
  'Metal Work',
  'Paintings & Art',
  'Food Products',
  'Leather Goods',
  'Bamboo & Cane',
  'Stone Carving',
  'Other',
];
