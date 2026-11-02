export interface SubCategoryItem {
  id: string;
  name: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  nameHi?: string;
  subcategories: SubCategoryItem[];
}

export const PRODUCT_CATEGORIES: CategoryItem[] = [
  {
    id: "cat_disease_management",
    name: "Disease Management",
    nameHi: "रोग प्रबंधन",
    subcategories: [
      { id: "subcat_disease_detection", name: "Disease Detection" },
      { id: "subcat_disease_prevention", name: "Disease Prevention" },
      { id: "subcat_ethnoveterinary_medicine", name: "Ethnoveterinary Medicine" },
    ],
  },
  {
    id: "cat_nutrition",
    name: "Nutrition",
    nameHi: "पोषण",
    subcategories: [
      { id: "subcat_nutrition_supplement", name: "Nutrition Supplement" },
    ],
  },
  {
    id: "cat_herd_management",
    name: "Herd Management",
    nameHi: "झुंड प्रबंधन",
    subcategories: [
      { id: "subcat_herd_detection", name: "Herd Detection" },
      { id: "subcat_herd_management", name: "Herd Management Tools" },
      { id: "subcat_milk_processing", name: "Milk Processing" },
      { id: "subcat_animal_id", name: "Animal Identification (RFID / Tags)" },
    ],
  },
  {
    id: "cat_breeding",
    name: "Breeding",
    nameHi: "प्रजनन",
    subcategories: [
      { id: "subcat_breeding_detection", name: "Breeding Detection" },
      { id: "subcat_ai_equipment", name: "A.I. Equipment" },
    ],
  },
  {
    id: "cat_farm_equipments",
    name: "Farm Equipments",
    nameHi: "फार्म उपकरण",
    subcategories: [
      { id: "subcat_milking", name: "Milking Equipment" },
      { id: "subcat_fodder", name: "Fodder Equipment" },
      { id: "subcat_cattle_comfort", name: "Cattle Comfort" },
      { id: "subcat_hygiene", name: "Hygiene & Sanitation" },
      { id: "subcat_monitoring", name: "Monitoring Tools" },
      { id: "subcat_farm_management", name: "Farm Management" },
      { id: "subcat_veterinarian_use", name: "Veterinarian Use" },
      { id: "subcat_farm_supplement", name: "Farm Supplement" },
      { id: "subcat_farm_maintenance", name: "Farm Maintenance" },
      { id: "subcat_farm_prevention", name: "Farm Prevention" },
    ],
  },
];

export function getSubcategoriesForCategory(categoryId: string): SubCategoryItem[] {
  const cat = PRODUCT_CATEGORIES.find((c) => c.id === categoryId);
  return cat ? cat.subcategories : [];
}

export function getCategoryName(categoryId: string): string {
  const cat = PRODUCT_CATEGORIES.find((c) => c.id === categoryId);
  return cat ? cat.name : categoryId.replace(/^cat_/, "").replace(/_/g, " ");
}

export function getSubcategoryName(categoryId: string, subCategoryId: string): string {
  const subs = getSubcategoriesForCategory(categoryId);
  const sub = subs.find((s) => s.id === subCategoryId);
  return sub ? sub.name : subCategoryId.replace(/^subcat_/, "").replace(/_/g, " ");
}
