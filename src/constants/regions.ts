export const INDIAN_STATES = [
  { id: 'AP', name: 'Andhra Pradesh' },
  { id: 'AR', name: 'Arunachal Pradesh' },
  { id: 'AS', name: 'Assam' },
  { id: 'BR', name: 'Bihar' },
  { id: 'CT', name: 'Chhattisgarh' },
  { id: 'GA', name: 'Goa' },
  { id: 'GJ', name: 'Gujarat' },
  { id: 'HR', name: 'Haryana' },
  { id: 'HP', name: 'Himachal Pradesh' },
  { id: 'JH', name: 'Jharkhand' },
  { id: 'KA', name: 'Karnataka' },
  { id: 'KL', name: 'Kerala' },
  { id: 'MP', name: 'Madhya Pradesh' },
  { id: 'MH', name: 'Maharashtra' },
  { id: 'MN', name: 'Manipur' },
  { id: 'ML', name: 'Meghalaya' },
  { id: 'MZ', name: 'Mizoram' },
  { id: 'NL', name: 'Nagaland' },
  { id: 'OD', name: 'Odisha' },
  { id: 'PB', name: 'Punjab' },
  { id: 'RJ', name: 'Rajasthan' },
  { id: 'SK', name: 'Sikkim' },
  { id: 'TN', name: 'Tamil Nadu' },
  { id: 'TG', name: 'Telangana' },
  { id: 'TR', name: 'Tripura' },
  { id: 'UP', name: 'Uttar Pradesh' },
  { id: 'UT', name: 'Uttarakhand' },
  { id: 'WB', name: 'West Bengal' },
  { id: 'AN', name: 'Andaman and Nicobar Islands' },
  { id: 'CH', name: 'Chandigarh' },
  { id: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { id: 'DL', name: 'Delhi' },
  { id: 'JK', name: 'Jammu and Kashmir' },
  { id: 'LA', name: 'Ladakh' },
  { id: 'LD', name: 'Lakshadweep' },
  { id: 'PY', name: 'Puducherry' }
];

export const getStateName = (id: string) => {
  const value = (id || '').trim();
  if (!value) {
    return 'Unknown';
  }

  const byCode = INDIAN_STATES.find((state) => state.id.toLowerCase() === value.toLowerCase());
  if (byCode) {
    return byCode.name;
  }

  const byName = INDIAN_STATES.find((state) => state.name.toLowerCase() === value.toLowerCase());
  return byName?.name || value;
};

export const getStateId = (name: string) => {
  const value = (name || '').trim();
  if (!value) {
    return '';
  }

  const byName = INDIAN_STATES.find((state) => state.name.toLowerCase() === value.toLowerCase());
  if (byName) {
    return byName.id;
  }

  const byCode = INDIAN_STATES.find((state) => state.id.toLowerCase() === value.toLowerCase());
  return byCode?.id || '';
};

// Regional classifications for product tags
export const REGIONS = [
  'North India',
  'South India',
  'East India',
  'West India',
  'Central India',
  'Northeast India',
  'All India',
];
