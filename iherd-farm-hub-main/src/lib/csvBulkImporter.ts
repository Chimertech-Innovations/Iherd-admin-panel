/**
 * Universal CSV Bulk Importer & Strict Validator for Products and Combo Products
 * - Fully aligns with Flutter `ProductListingEntity` and `ComboProduct` schemas
 * - Mandatory 6-Language Support: English (en), Hindi (hi), Kannada (kn), Marathi (mr), Punjabi (pa), Tamil (ta)
 * - Strict "All-or-Nothing" validation: If ANY required column or row data is missing in the CSV,
 *   the entire batch is strictly rejected and shows: "This field is not in the CSV: [field]. Please fill this missing field and re-upload."
 * - Zero items are committed to Firebase until all required fields and translations are present.
 */

import { convertToDirectImageUrl } from "@/lib/utils";
import {
  PRODUCT_CATEGORIES,
  getCategoryName,
  getSubcategoryName,
} from "@/lib/categories";

export interface CsvValidationError {
  row: number | string;
  field: string;
  value?: any;
  message: string;
  suggestion: string;
}

export interface CsvImportResult<T = any> {
  success: boolean;
  totalRows: number;
  validRows: number;
  errors: CsvValidationError[];
  data: T[];
}

/**
 * MANDATORY REQUIRED COLUMNS FOR PRODUCTS
 * If any of these columns are absent from the CSV header or empty in any row, the upload is rejected.
 */
export const MANDATORY_PRODUCT_COLUMNS: { key: string; label: string; group: string }[] = [
  // Product Names across all 6 languages
  { key: "name_en", label: "Product Name (English)", group: "Identity" },
  { key: "name_hi", label: "Product Name (Hindi)", group: "Identity" },
  { key: "name_kn", label: "Product Name (Kannada)", group: "Identity" },
  { key: "name_mr", label: "Product Name (Marathi)", group: "Identity" },
  { key: "name_pa", label: "Product Name (Punjabi)", group: "Identity" },
  { key: "name_ta", label: "Product Name (Tamil)", group: "Identity" },

  // Commercial Pricing & Category
  { key: "price", label: "Selling Price (₹)", group: "Pricing" },
  { key: "mrp", label: "MRP Price (₹)", group: "Pricing" },
  { key: "categoryid", label: "Category ID (categoryId)", group: "Category" },
  { key: "subcategoryid", label: "Subcategory ID (subCategoryId)", group: "Category" },

  // Weight & Units across all 6 languages
  { key: "weight", label: "Product Weight (numeric)", group: "Units" },
  { key: "weightunit_en", label: "Weight Unit (English)", group: "Units" },
  { key: "weightunit_hi", label: "Weight Unit (Hindi)", group: "Units" },
  { key: "weightunit_kn", label: "Weight Unit (Kannada)", group: "Units" },
  { key: "weightunit_mr", label: "Weight Unit (Marathi)", group: "Units" },
  { key: "weightunit_pa", label: "Weight Unit (Punjabi)", group: "Units" },
  { key: "weightunit_ta", label: "Weight Unit (Tamil)", group: "Units" },

  // Quantity & Units across all 6 languages
  { key: "quantity", label: "Quantity (numeric)", group: "Units" },
  { key: "quantityunit_en", label: "Quantity Unit (English)", group: "Units" },
  { key: "quantityunit_hi", label: "Quantity Unit (Hindi)", group: "Units" },
  { key: "quantityunit_kn", label: "Quantity Unit (Kannada)", group: "Units" },
  { key: "quantityunit_mr", label: "Quantity Unit (Marathi)", group: "Units" },
  { key: "quantityunit_pa", label: "Quantity Unit (Punjabi)", group: "Units" },
  { key: "quantityunit_ta", label: "Quantity Unit (Tamil)", group: "Units" },

  // Media
  { key: "thumbnailurl", label: "Primary Thumbnail URL", group: "Media" },

  // Description across all 6 languages
  { key: "description_en", label: "Description (English)", group: "Description" },
  { key: "description_hi", label: "Description (Hindi)", group: "Description" },
  { key: "description_kn", label: "Description (Kannada)", group: "Description" },
  { key: "description_mr", label: "Description (Marathi)", group: "Description" },
  { key: "description_pa", label: "Description (Punjabi)", group: "Description" },
  { key: "description_ta", label: "Description (Tamil)", group: "Description" },

  // Specifications across all 6 languages
  { key: "specification_en", label: "Specification (English)", group: "Specifications" },
  { key: "specification_hi", label: "Specification (Hindi)", group: "Specifications" },
  { key: "specification_kn", label: "Specification (Kannada)", group: "Specifications" },
  { key: "specification_mr", label: "Specification (Marathi)", group: "Specifications" },
  { key: "specification_pa", label: "Specification (Punjabi)", group: "Specifications" },
  { key: "specification_ta", label: "Specification (Tamil)", group: "Specifications" },

  // Instructions across all 6 languages
  { key: "instructionstouse_en", label: "Instructions to Use (English)", group: "Instructions" },
  { key: "instructionstouse_hi", label: "Instructions to Use (Hindi)", group: "Instructions" },
  { key: "instructionstouse_kn", label: "Instructions to Use (Kannada)", group: "Instructions" },
  { key: "instructionstouse_mr", label: "Instructions to Use (Marathi)", group: "Instructions" },
  { key: "instructionstouse_pa", label: "Instructions to Use (Punjabi)", group: "Instructions" },
  { key: "instructionstouse_ta", label: "Instructions to Use (Tamil)", group: "Instructions" },

  // Ingredients across all 6 languages
  { key: "productingredients_en", label: "Product Ingredients (English)", group: "Ingredients" },
  { key: "productingredients_hi", label: "Product Ingredients (Hindi)", group: "Ingredients" },
  { key: "productingredients_kn", label: "Product Ingredients (Kannada)", group: "Ingredients" },
  { key: "productingredients_mr", label: "Product Ingredients (Marathi)", group: "Ingredients" },
  { key: "productingredients_pa", label: "Product Ingredients (Punjabi)", group: "Ingredients" },
  { key: "productingredients_ta", label: "Product Ingredients (Tamil)", group: "Ingredients" },

  // Storage across all 6 languages
  { key: "storagecondition_en", label: "Storage Condition (English)", group: "Storage" },
  { key: "storagecondition_hi", label: "Storage Condition (Hindi)", group: "Storage" },
  { key: "storagecondition_kn", label: "Storage Condition (Kannada)", group: "Storage" },
  { key: "storagecondition_mr", label: "Storage Condition (Marathi)", group: "Storage" },
  { key: "storagecondition_pa", label: "Storage Condition (Punjabi)", group: "Storage" },
  { key: "storagecondition_ta", label: "Storage Condition (Tamil)", group: "Storage" },

  // Best Before / Shelf Life across all 6 languages
  { key: "bestbefore_en", label: "Best Before (English)", group: "Expiry" },
  { key: "bestbefore_hi", label: "Best Before (Hindi)", group: "Expiry" },
  { key: "bestbefore_kn", label: "Best Before (Kannada)", group: "Expiry" },
  { key: "bestbefore_mr", label: "Best Before (Marathi)", group: "Expiry" },
  { key: "bestbefore_pa", label: "Best Before (Punjabi)", group: "Expiry" },
  { key: "bestbefore_ta", label: "Best Before (Tamil)", group: "Expiry" },

  // Seller Name across all 6 languages
  { key: "sellername_en", label: "Seller Name (English)", group: "Seller" },
  { key: "sellername_hi", label: "Seller Name (Hindi)", group: "Seller" },
  { key: "sellername_kn", label: "Seller Name (Kannada)", group: "Seller" },
  { key: "sellername_mr", label: "Seller Name (Marathi)", group: "Seller" },
  { key: "sellername_pa", label: "Seller Name (Punjabi)", group: "Seller" },
  { key: "sellername_ta", label: "Seller Name (Tamil)", group: "Seller" },
  { key: "sellerlogo", label: "Seller Brand Logo URL (sellerLogo)", group: "Seller" },

  // Financial & Tax
  { key: "gst", label: "GST Tax Rate (%)", group: "Tax" },
];

/**
 * MANDATORY REQUIRED COLUMNS FOR COMBOS
 */
export const MANDATORY_COMBO_COLUMNS: { key: string; label: string; group: string }[] = [
  // Combo Names across all 6 languages
  { key: "name_en", label: "Combo Name (English)", group: "Identity" },
  { key: "name_hi", label: "Combo Name (Hindi)", group: "Identity" },
  { key: "name_kn", label: "Combo Name (Kannada)", group: "Identity" },
  { key: "name_mr", label: "Combo Name (Marathi)", group: "Identity" },
  { key: "name_pa", label: "Combo Name (Punjabi)", group: "Identity" },
  { key: "name_ta", label: "Combo Name (Tamil)", group: "Identity" },

  // Pricing & Category
  { key: "price", label: "Combo Selling Price (₹)", group: "Pricing" },
  { key: "mrp", label: "Combo MRP Price (₹)", group: "Pricing" },
  { key: "categoryid", label: "Category ID (categoryId)", group: "Category" },
  { key: "subcategoryid", label: "Subcategory ID (subCategoryId)", group: "Category" },

  // Weight & Units across all 6 languages
  { key: "weight", label: "Combo Weight (numeric)", group: "Units" },
  { key: "weightunit_en", label: "Weight Unit (English)", group: "Units" },
  { key: "weightunit_hi", label: "Weight Unit (Hindi)", group: "Units" },
  { key: "weightunit_kn", label: "Weight Unit (Kannada)", group: "Units" },
  { key: "weightunit_mr", label: "Weight Unit (Marathi)", group: "Units" },
  { key: "weightunit_pa", label: "Weight Unit (Punjabi)", group: "Units" },
  { key: "weightunit_ta", label: "Weight Unit (Tamil)", group: "Units" },

  // Quantity & Units across all 6 languages
  { key: "quantity", label: "Quantity (numeric)", group: "Units" },
  { key: "quantityunit_en", label: "Quantity Unit (English)", group: "Units" },
  { key: "quantityunit_hi", label: "Quantity Unit (Hindi)", group: "Units" },
  { key: "quantityunit_kn", label: "Quantity Unit (Kannada)", group: "Units" },
  { key: "quantityunit_mr", label: "Quantity Unit (Marathi)", group: "Units" },
  { key: "quantityunit_pa", label: "Quantity Unit (Punjabi)", group: "Units" },
  { key: "quantityunit_ta", label: "Quantity Unit (Tamil)", group: "Units" },

  // Media
  { key: "thumbnailurl", label: "Primary Thumbnail URL", group: "Media" },

  // Description across all 6 languages
  { key: "desc_en", label: "Description (English)", group: "Description" },
  { key: "desc_hi", label: "Description (Hindi)", group: "Description" },
  { key: "desc_kn", label: "Description (Kannada)", group: "Description" },
  { key: "desc_mr", label: "Description (Marathi)", group: "Description" },
  { key: "desc_pa", label: "Description (Punjabi)", group: "Description" },
  { key: "desc_ta", label: "Description (Tamil)", group: "Description" },

  // Specifications across all 6 languages
  { key: "spec_en", label: "Specification (English)", group: "Specifications" },
  { key: "spec_hi", label: "Specification (Hindi)", group: "Specifications" },
  { key: "spec_kn", label: "Specification (Kannada)", group: "Specifications" },
  { key: "spec_mr", label: "Specification (Marathi)", group: "Specifications" },
  { key: "spec_pa", label: "Specification (Punjabi)", group: "Specifications" },
  { key: "spec_ta", label: "Specification (Tamil)", group: "Specifications" },

  // Instructions across all 6 languages
  { key: "instructions_en", label: "Instructions (English)", group: "Instructions" },
  { key: "instructions_hi", label: "Instructions (Hindi)", group: "Instructions" },
  { key: "instructions_kn", label: "Instructions (Kannada)", group: "Instructions" },
  { key: "instructions_mr", label: "Instructions (Marathi)", group: "Instructions" },
  { key: "instructions_pa", label: "Instructions (Punjabi)", group: "Instructions" },
  { key: "instructions_ta", label: "Instructions (Tamil)", group: "Instructions" },

  // Ingredients across all 6 languages
  { key: "ingredients_en", label: "Ingredients (English)", group: "Ingredients" },
  { key: "ingredients_hi", label: "Ingredients (Hindi)", group: "Ingredients" },
  { key: "ingredients_kn", label: "Ingredients (Kannada)", group: "Ingredients" },
  { key: "ingredients_mr", label: "Ingredients (Marathi)", group: "Ingredients" },
  { key: "ingredients_pa", label: "Ingredients (Punjabi)", group: "Ingredients" },
  { key: "ingredients_ta", label: "Ingredients (Tamil)", group: "Ingredients" },

  // Storage Condition across all 6 languages
  { key: "storage_en", label: "Storage Condition (English)", group: "Storage" },
  { key: "storage_hi", label: "Storage Condition (Hindi)", group: "Storage" },
  { key: "storage_kn", label: "Storage Condition (Kannada)", group: "Storage" },
  { key: "storage_mr", label: "Storage Condition (Marathi)", group: "Storage" },
  { key: "storage_pa", label: "Storage Condition (Punjabi)", group: "Storage" },
  { key: "storage_ta", label: "Storage Condition (Tamil)", group: "Storage" },

  // Best Before across all 6 languages
  { key: "best_before_en", label: "Best Before (English)", group: "Expiry" },
  { key: "best_before_hi", label: "Best Before (Hindi)", group: "Expiry" },
  { key: "best_before_kn", label: "Best Before (Kannada)", group: "Expiry" },
  { key: "best_before_mr", label: "Best Before (Marathi)", group: "Expiry" },
  { key: "best_before_pa", label: "Best Before (Punjabi)", group: "Expiry" },
  { key: "best_before_ta", label: "Best Before (Tamil)", group: "Expiry" },

  // Seller Names across all 6 languages
  { key: "sellername_en", label: "Seller Name (English)", group: "Seller" },
  { key: "sellername_hi", label: "Seller Name (Hindi)", group: "Seller" },
  { key: "sellername_kn", label: "Seller Name (Kannada)", group: "Seller" },
  { key: "sellername_mr", label: "Seller Name (Marathi)", group: "Seller" },
  { key: "sellername_pa", label: "Seller Name (Punjabi)", group: "Seller" },
  { key: "sellername_ta", label: "Seller Name (Tamil)", group: "Seller" },
  { key: "sellerlogo", label: "Seller Brand Logo URL (sellerLogo)", group: "Seller" },

  // Tax
  { key: "gst", label: "GST Tax Rate (%)", group: "Tax" },
];

/**
 * Robust RFC-4180 CSV parser
 */
export function parseCsvRaw(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  let cleanText = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!cleanText.trim()) {
    return { headers: [], rows: [] };
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\n") {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  const rawHeaders = rows[0].map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const normalizedHeaders = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[\s\-\.]+/g, "_").replace(/[^a-z0-9_]/g, "")
  );

  const parsedObjects: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const rowValues = rows[r];
    if (rowValues.every((val) => !val || val.trim() === "")) continue;

    const rowObj: Record<string, string> = {};
    for (let h = 0; h < normalizedHeaders.length; h++) {
      const headerKey = normalizedHeaders[h];
      const val = rowValues[h] !== undefined ? rowValues[h].trim() : "";
      if (headerKey) {
        rowObj[headerKey] = val;
      }
    }
    parsedObjects.push(rowObj);
  }

  return { headers: normalizedHeaders, rows: parsedObjects };
}

// Helper to look up a field from normalized headers with multiple aliases
function getVal(row: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const norm = alias.toLowerCase().replace(/[\s\-\.]+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (row[norm] !== undefined && row[norm] !== "") {
      return row[norm];
    }
  }
  return "";
}

/**
 * Builds multi-language string map from English + 5 regional translations (hi, kn, mr, pa, ta) + id.
 */
function buildMultiLang(
  row: Record<string, string>,
  fieldAliases: string | string[],
  fallback = ""
): Record<string, string> {
  const aliases = Array.isArray(fieldAliases) ? fieldAliases : [fieldAliases];

  const getLangVal = (langCodes: string[]): string => {
    const candidateKeys: string[] = [];
    for (const a of aliases) {
      for (const lc of langCodes) {
        candidateKeys.push(`${a}_${lc}`);
        candidateKeys.push(`${a}${lc}`);
      }
    }
    return getVal(row, candidateKeys);
  };

  const enVal =
    getLangVal(["en", "english"]) ||
    getVal(row, aliases) ||
    fallback;

  const hiVal = getLangVal(["hi", "hindi"]) || enVal;
  const knVal = getLangVal(["kn", "kannada"]) || enVal;
  const mrVal = getLangVal(["mr", "marathi"]) || enVal;
  const paVal = getLangVal(["pa", "punjabi"]) || enVal;
  const taVal = getLangVal(["ta", "tamil"]) || enVal;
  const idVal = getLangVal(["id", "indonesian"]) || enVal;

  return {
    en: enVal,
    hi: hiVal,
    kn: knVal,
    mr: mrVal,
    pa: paVal,
    ta: taVal,
    id: idVal,
  };
}

/**
 * VALIDATE AND PARSE BULK STANDARD PRODUCTS
 * Strict All-or-Nothing check for ProductListingEntity
 * Strictly rejects CSV if ANY required column or multi-language translation is missing.
 */
export function validateBulkProducts(
  csvRows: Record<string, string>[],
  existingCategories: any[] = [],
  csvHeaders: string[] = []
): CsvImportResult<any> {
  const errors: CsvValidationError[] = [];
  const validProducts: any[] = [];

  // 1. STEP 1: Strict Header Check - Verify every mandatory column exists in the CSV
  if (csvHeaders && csvHeaders.length > 0) {
    const normHeaders = new Set(
      csvHeaders.map((h) => h.toLowerCase().replace(/[\s\-\.]+/g, "_").replace(/[^a-z0-9_]/g, ""))
    );

    for (const reqCol of MANDATORY_PRODUCT_COLUMNS) {
      // Check if key or any common alias is present in header
      const keyNorm = reqCol.key.toLowerCase().replace(/[\s\-\.]+/g, "_").replace(/[^a-z0-9_]/g, "");
      if (!normHeaders.has(keyNorm)) {
        errors.push({
          row: 1,
          field: reqCol.key,
          message: `This field is not in the CSV: '${reqCol.key}' (${reqCol.label}).`,
          suggestion: `Please add column '${reqCol.key}' into your CSV file, fill in the data, and re-upload.`,
        });
      }
    }
  }

  // 2. STEP 2: Strict Row Data Check - Verify each row has valid, non-empty data for all required fields
  csvRows.forEach((row, idx) => {
    const rowNum = idx + 2; // Row 1 is header in CSV spreadsheet

    // Multi-Language Names (en, hi, kn, mr, pa, ta)
    const nameEn = getVal(row, ["name_en", "name", "title"]);
    if (!nameEn) {
      errors.push({
        row: rowNum,
        field: "name_en",
        message: `Missing data in CSV: 'name_en' (Product Name - English) is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_en' on Row ${rowNum} and re-upload.`,
      });
    }
    const nameHi = getVal(row, ["name_hi"]);
    if (!nameHi) {
      errors.push({
        row: rowNum,
        field: "name_hi",
        message: `Missing data in CSV: 'name_hi' (Product Name - Hindi) is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_hi' on Row ${rowNum} and re-upload.`,
      });
    }
    const nameKn = getVal(row, ["name_kn"]);
    if (!nameKn) {
      errors.push({
        row: rowNum,
        field: "name_kn",
        message: `Missing data in CSV: 'name_kn' (Product Name - Kannada) is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_kn' on Row ${rowNum} and re-upload.`,
      });
    }
    const nameMr = getVal(row, ["name_mr"]);
    if (!nameMr) {
      errors.push({
        row: rowNum,
        field: "name_mr",
        message: `Missing data in CSV: 'name_mr' (Product Name - Marathi) is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_mr' on Row ${rowNum} and re-upload.`,
      });
    }
    const namePa = getVal(row, ["name_pa"]);
    if (!namePa) {
      errors.push({
        row: rowNum,
        field: "name_pa",
        message: `Missing data in CSV: 'name_pa' (Product Name - Punjabi) is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_pa' on Row ${rowNum} and re-upload.`,
      });
    }
    const nameTa = getVal(row, ["name_ta"]);
    if (!nameTa) {
      errors.push({
        row: rowNum,
        field: "name_ta",
        message: `Missing data in CSV: 'name_ta' (Product Name - Tamil) is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_ta' on Row ${rowNum} and re-upload.`,
      });
    }

    // Selling Price
    const priceStr = getVal(row, ["price", "selling_price"]);
    const price = Number(priceStr);
    if (!priceStr || isNaN(price) || price <= 0) {
      errors.push({
        row: rowNum,
        field: "price",
        value: priceStr,
        message: `Selling Price '${priceStr || "EMPTY"}' on Row ${rowNum} is invalid. Must be greater than ₹0.`,
        suggestion: "Enter a valid numeric selling price (e.g. 499).",
      });
    }

    // MRP Price
    const mrpStr = getVal(row, ["mrp", "mrp_price"]);
    const mrp = Number(mrpStr);
    if (!mrpStr || isNaN(mrp) || mrp <= 0) {
      errors.push({
        row: rowNum,
        field: "mrp",
        value: mrpStr,
        message: `MRP Price '${mrpStr || "EMPTY"}' on Row ${rowNum} is invalid. Must be greater than ₹0.`,
        suggestion: "Enter a valid numeric MRP (e.g. 599).",
      });
    } else if (price > 0 && mrp <= price) {
      errors.push({
        row: rowNum,
        field: "mrp",
        value: `MRP: ${mrp}, Price: ${price}`,
        message: `Invalid Price Condition on Row ${rowNum}: MRP (₹${mrp}) must be strictly GREATER than Selling Price (₹${price}).`,
        suggestion: "Ensure MRP is higher than Selling Price so discounts can be calculated.",
      });
    }

    // Category ID
    const categoryId = getVal(row, ["categoryid", "category_id"]);
    if (!categoryId) {
      errors.push({
        row: rowNum,
        field: "categoryId",
        message: `Category ID is missing on Row ${rowNum}.`,
        suggestion: "Enter a valid categoryId (e.g. 'cat_breeding', 'cat_disease_management', 'cat_nutrition', 'cat_farm_equipments').",
      });
    }

    // Weight
    const weightStr = getVal(row, ["weight"]);
    const weight = Number(weightStr);
    if (!weightStr || isNaN(weight) || weight <= 0) {
      errors.push({
        row: rowNum,
        field: "weight",
        value: weightStr,
        message: `Product Weight '${weightStr || "EMPTY"}' on Row ${rowNum} is invalid. Must be greater than 0.`,
        suggestion: "Enter weight in grams or kg (e.g. 250).",
      });
    }

    // Multi-Language Descriptions (en, hi, kn, mr, pa, ta)
    const descEn = getVal(row, ["description_en", "desc_en"]);
    if (!descEn) {
      errors.push({
        row: rowNum,
        field: "description_en",
        message: `Missing data in CSV: 'description_en' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'description_en' on Row ${rowNum} and re-upload.`,
      });
    }
    const descHi = getVal(row, ["description_hi"]);
    if (!descHi) {
      errors.push({
        row: rowNum,
        field: "description_hi",
        message: `Missing data in CSV: 'description_hi' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'description_hi' on Row ${rowNum} and re-upload.`,
      });
    }
    const descKn = getVal(row, ["description_kn"]);
    if (!descKn) {
      errors.push({
        row: rowNum,
        field: "description_kn",
        message: `Missing data in CSV: 'description_kn' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'description_kn' on Row ${rowNum} and re-upload.`,
      });
    }
    const descMr = getVal(row, ["description_mr"]);
    if (!descMr) {
      errors.push({
        row: rowNum,
        field: "description_mr",
        message: `Missing data in CSV: 'description_mr' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'description_mr' on Row ${rowNum} and re-upload.`,
      });
    }
    const descPa = getVal(row, ["description_pa"]);
    if (!descPa) {
      errors.push({
        row: rowNum,
        field: "description_pa",
        message: `Missing data in CSV: 'description_pa' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'description_pa' on Row ${rowNum} and re-upload.`,
      });
    }
    const descTa = getVal(row, ["description_ta"]);
    if (!descTa) {
      errors.push({
        row: rowNum,
        field: "description_ta",
        message: `Missing data in CSV: 'description_ta' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'description_ta' on Row ${rowNum} and re-upload.`,
      });
    }

    // Specifications (en, hi, kn, mr, pa, ta)
    const specEn = getVal(row, ["specification_en"]);
    if (!specEn) {
      errors.push({
        row: rowNum,
        field: "specification_en",
        message: `Missing data in CSV: 'specification_en' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'specification_en' on Row ${rowNum} and re-upload.`,
      });
    }

    // Instructions to Use (en, hi, kn, mr, pa, ta)
    const instEn = getVal(row, ["instructionstouse_en", "instructions_en"]);
    if (!instEn) {
      errors.push({
        row: rowNum,
        field: "instructionsToUse_en",
        message: `Missing data in CSV: 'instructionsToUse_en' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'instructionsToUse_en' on Row ${rowNum} and re-upload.`,
      });
    }

    // Product Ingredients (en, hi, kn, mr, pa, ta)
    const ingEn = getVal(row, ["productingredients_en", "ingredients_en"]);
    if (!ingEn) {
      errors.push({
        row: rowNum,
        field: "productIngredients_en",
        message: `Missing data in CSV: 'productIngredients_en' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'productIngredients_en' on Row ${rowNum} and re-upload.`,
      });
    }

    // Storage Condition (en, hi, kn, mr, pa, ta)
    const storageEn = getVal(row, ["storagecondition_en", "storage_en"]);
    if (!storageEn) {
      errors.push({
        row: rowNum,
        field: "storageCondition_en",
        message: `Missing data in CSV: 'storageCondition_en' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'storageCondition_en' on Row ${rowNum} and re-upload.`,
      });
    }

    // Best Before (en, hi, kn, mr, pa, ta)
    const bbEn = getVal(row, ["bestbefore_en", "best_before_en"]);
    if (!bbEn) {
      errors.push({
        row: rowNum,
        field: "bestBefore_en",
        message: `Missing data in CSV: 'bestBefore_en' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'bestBefore_en' on Row ${rowNum} and re-upload.`,
      });
    }

    // Thumbnail / Image
    const thumbRaw = getVal(row, ["thumbnailurl", "thumbnail_url", "image"]);
    const rawImagesStr = getVal(row, ["imageurls", "image_urls"]);
    const parsedImages = rawImagesStr
      ? rawImagesStr.split(/[;|,]/).map((s) => s.trim()).filter(Boolean)
      : [];
    const directThumb = convertToDirectImageUrl(thumbRaw || (parsedImages.length > 0 ? parsedImages[0] : ""));
    const directImages = Array.from(
      new Set([directThumb, ...parsedImages.map((u) => convertToDirectImageUrl(u))].filter(Boolean))
    );

    if (!directThumb && directImages.length === 0) {
      errors.push({
        row: rowNum,
        field: "thumbnailUrl",
        message: `Product Thumbnail image is missing on Row ${rowNum}.`,
        suggestion: "Provide an image URL (Direct CDN or Google Drive link) under 'thumbnailUrl'.",
      });
    }

    // Seller Logo
    const sellerLogoRaw = getVal(row, ["sellerlogo", "seller_logo"]);
    if (!sellerLogoRaw) {
      errors.push({
        row: rowNum,
        field: "sellerLogo",
        message: `Missing data in CSV: 'sellerLogo' (Seller Brand Logo URL) is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'sellerLogo' with a valid logo image URL on Row ${rowNum} and re-upload.`,
      });
    }

    // Construct valid ProductListingEntity if all required validations pass
    if (errors.length === 0) {
      const prodId = getVal(row, ["id", "productid", "product_id"]) || `PRD-${Date.now()}-${idx}`;
      const subCategoryId = getVal(row, ["subcategoryid", "subcategory_id"]) || "";
      const quantity = Math.round(Number(getVal(row, ["quantity"])) || 1);
      const stock = Math.round(Number(getVal(row, ["stock"])) || 100);
      const gst = Number(getVal(row, ["gst"])) || 5.0;
      const rating = Number(getVal(row, ["rating"])) || 4.5;
      const bestSeller = ["true", "1", "yes"].includes(getVal(row, ["bestseller", "isbestseller"]).toLowerCase());

      const selectedCategoryObj: any =
        existingCategories.find((c: any) => c.id === categoryId) ||
        PRODUCT_CATEGORIES.find((c) => c.id === categoryId);
      const categoryNameEn = selectedCategoryObj
        ? (selectedCategoryObj.name?.en || selectedCategoryObj.name || categoryId)
        : getCategoryName(categoryId);
      const selectedSubCategoryObj: any =
        selectedCategoryObj?.subcategories?.find((s: any) => s.id === subCategoryId);
      const subCategoryNameEn = selectedSubCategoryObj
        ? (selectedSubCategoryObj.name?.en || selectedSubCategoryObj.name || subCategoryId)
        : getSubcategoryName(categoryId, subCategoryId);

      const categoryMap = {
        en: categoryNameEn,
        hi: selectedCategoryObj?.name?.hi || selectedCategoryObj?.nameHi || categoryNameEn,
        kn: selectedCategoryObj?.name?.kn || categoryNameEn,
        mr: selectedCategoryObj?.name?.mr || categoryNameEn,
        pa: selectedCategoryObj?.name?.pa || categoryNameEn,
        ta: selectedCategoryObj?.name?.ta || categoryNameEn,
        id: selectedCategoryObj?.name?.id || categoryNameEn,
      };

      const subCategoryMap = {
        en: subCategoryNameEn,
        hi: selectedSubCategoryObj?.name?.hi || subCategoryNameEn,
        kn: selectedSubCategoryObj?.name?.kn || subCategoryNameEn,
        mr: selectedSubCategoryObj?.name?.mr || subCategoryNameEn,
        pa: selectedSubCategoryObj?.name?.pa || subCategoryNameEn,
        ta: selectedSubCategoryObj?.name?.ta || subCategoryNameEn,
        id: selectedSubCategoryObj?.name?.id || subCategoryNameEn,
      };

      const productPayload: any = {
        id: prodId,
        name: buildMultiLang(row, ["name", "product_name"], nameEn),
        price,
        mrp,
        rating,
        quantity,
        stock,
        weight,
        weightUnit: buildMultiLang(row, ["weightunit", "weight_unit"], getVal(row, ["weightunit_en", "weightunit"]) || "g"),
        quantityUnit: buildMultiLang(row, ["quantityunit", "quantity_unit"], getVal(row, ["quantityunit_en", "quantityunit"]) || "Unit"),
        categoryId,
        subCategoryId,
        category: categoryMap,
        subCategory: subCategoryMap,
        thumbnailUrl: directThumb || directImages[0] || "",
        imageUrls: directImages.length > 0 ? directImages : [directThumb],
        description: buildMultiLang(row, ["description", "desc"], descEn),
        specification: buildMultiLang(row, ["specification", "spec"], specEn),
        instructionsToUse: buildMultiLang(row, ["instructionstouse", "instructions", "instruction"], instEn),
        productIngredients: buildMultiLang(row, ["productingredients", "ingredients", "ingredient"], ingEn),
        storageCondition: buildMultiLang(row, ["storagecondition", "storage"], storageEn),
        bestBefore: buildMultiLang(row, ["bestbefore", "best_before", "expiry"], bbEn),
        best_before: buildMultiLang(row, ["bestbefore", "best_before", "expiry"], bbEn),
        usage: (getVal(row, ["usage_en"]) || getVal(row, ["usage_hi"])) ? {
          en: getVal(row, ["usage_en"]) || getVal(row, ["usage_hi"]),
          hi: getVal(row, ["usage_hi"]) || getVal(row, ["usage_en"]),
        } : null,
        sellerName: buildMultiLang(row, ["sellername", "seller_name", "brand"], getVal(row, ["sellername_en", "sellername"]) || "Chimertech"),
        sellerType: getVal(row, ["sellertype", "seller_type"]) || "seller",
        sellerLogo: convertToDirectImageUrl(sellerLogoRaw) || sellerLogoRaw || "",
        gst,
        cartAddded: false,
        bestSeller,
        isBestSeller: bestSeller,
        isActive: true,
        postedByRole: "admin",
        postedByUid: "admin-bulk-csv",
        deliveryConfig: null,
        updatedAt: new Date().toISOString(),
      };

      validProducts.push(productPayload);
    }
  });

  return {
    success: errors.length === 0,
    totalRows: csvRows.length,
    validRows: validProducts.length,
    errors,
    data: errors.length === 0 ? validProducts : [],
  };
}

/**
 * VALIDATE AND PARSE BULK COMBO PRODUCTS
 * Strict All-or-Nothing check for ComboProduct
 * Strictly rejects CSV if ANY required column or multi-language translation is missing.
 */
export function validateBulkCombos(
  csvRows: Record<string, string>[],
  existingCategories: any[] = [],
  csvHeaders: string[] = []
): CsvImportResult<any> {
  const errors: CsvValidationError[] = [];
  const validCombos: any[] = [];

  // 1. Strict Header Check
  if (csvHeaders && csvHeaders.length > 0) {
    const normHeaders = new Set(
      csvHeaders.map((h) => h.toLowerCase().replace(/[\s\-\.]+/g, "_").replace(/[^a-z0-9_]/g, ""))
    );

    for (const reqCol of MANDATORY_COMBO_COLUMNS) {
      const keyNorm = reqCol.key.toLowerCase().replace(/[\s\-\.]+/g, "_").replace(/[^a-z0-9_]/g, "");
      if (!normHeaders.has(keyNorm)) {
        errors.push({
          row: 1,
          field: reqCol.key,
          message: `This field is not in the CSV: '${reqCol.key}' (${reqCol.label}).`,
          suggestion: `Please add column '${reqCol.key}' into your CSV file, fill in the data, and re-upload.`,
        });
      }
    }
  }

  // 2. Strict Row Data Check
  csvRows.forEach((row, idx) => {
    const rowNum = idx + 2;

    // Names (en, hi, kn, mr, pa, ta)
    const nameEn = getVal(row, ["name_en", "combo_name_en", "name"]);
    if (!nameEn) {
      errors.push({
        row: rowNum,
        field: "name_en",
        message: `Missing data in CSV: 'name_en' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_en' on Row ${rowNum} and re-upload.`,
      });
    }
    const nameHi = getVal(row, ["name_hi"]);
    if (!nameHi) {
      errors.push({
        row: rowNum,
        field: "name_hi",
        message: `Missing data in CSV: 'name_hi' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_hi' on Row ${rowNum} and re-upload.`,
      });
    }
    const nameKn = getVal(row, ["name_kn"]);
    if (!nameKn) {
      errors.push({
        row: rowNum,
        field: "name_kn",
        message: `Missing data in CSV: 'name_kn' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_kn' on Row ${rowNum} and re-upload.`,
      });
    }
    const nameMr = getVal(row, ["name_mr"]);
    if (!nameMr) {
      errors.push({
        row: rowNum,
        field: "name_mr",
        message: `Missing data in CSV: 'name_mr' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_mr' on Row ${rowNum} and re-upload.`,
      });
    }
    const namePa = getVal(row, ["name_pa"]);
    if (!namePa) {
      errors.push({
        row: rowNum,
        field: "name_pa",
        message: `Missing data in CSV: 'name_pa' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_pa' on Row ${rowNum} and re-upload.`,
      });
    }
    const nameTa = getVal(row, ["name_ta"]);
    if (!nameTa) {
      errors.push({
        row: rowNum,
        field: "name_ta",
        message: `Missing data in CSV: 'name_ta' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'name_ta' on Row ${rowNum} and re-upload.`,
      });
    }

    // Price
    const priceStr = getVal(row, ["price", "selling_price"]);
    const price = Number(priceStr);
    if (!priceStr || isNaN(price) || price <= 0) {
      errors.push({
        row: rowNum,
        field: "price",
        value: priceStr,
        message: `Selling Price '${priceStr || "EMPTY"}' on Row ${rowNum} is invalid. Must be greater than ₹0.`,
        suggestion: "Enter valid selling price (e.g. 899).",
      });
    }

    // MRP Price
    const mrpStr = getVal(row, ["mrp", "mrp_price"]);
    const mrp = Number(mrpStr);
    if (!mrpStr || isNaN(mrp) || mrp <= 0) {
      errors.push({
        row: rowNum,
        field: "mrp",
        value: mrpStr,
        message: `MRP Price '${mrpStr || "EMPTY"}' on Row ${rowNum} is invalid. Must be greater than ₹0.`,
        suggestion: "Enter valid MRP (e.g. 1199).",
      });
    } else if (price > 0 && mrp <= price) {
      errors.push({
        row: rowNum,
        field: "mrp",
        value: `MRP: ${mrp}, Price: ${price}`,
        message: `Invalid Combo Price Condition on Row ${rowNum}: MRP (₹${mrp}) must be strictly GREATER than Selling Price (₹${price}).`,
        suggestion: "Ensure combo bundle MRP is higher than discounted selling price.",
      });
    }

    // Category ID
    const categoryId = getVal(row, ["categoryid", "category_id"]);
    if (!categoryId) {
      errors.push({
        row: rowNum,
        field: "categoryId",
        message: `Combo Category ID is missing on Row ${rowNum}.`,
        suggestion: "Enter categoryId (e.g. 'cat_disease_management' or 'cat_breeding').",
      });
    }

    // Weight
    const weightStr = getVal(row, ["weight"]);
    const weight = Number(weightStr);
    if (!weightStr || isNaN(weight) || weight <= 0) {
      errors.push({
        row: rowNum,
        field: "weight",
        value: weightStr,
        message: `Combo Weight '${weightStr || "EMPTY"}' on Row ${rowNum} is invalid. Must be greater than 0.`,
        suggestion: "Enter total weight in grams (e.g. 500).",
      });
    }

    // Descriptions (en, hi, kn, mr, pa, ta)
    const descEn = getVal(row, ["desc_en", "description_en"]);
    if (!descEn) {
      errors.push({
        row: rowNum,
        field: "desc_en",
        message: `Missing data in CSV: 'desc_en' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'desc_en' on Row ${rowNum} and re-upload.`,
      });
    }
    const descHi = getVal(row, ["desc_hi"]);
    if (!descHi) {
      errors.push({
        row: rowNum,
        field: "desc_hi",
        message: `Missing data in CSV: 'desc_hi' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'desc_hi' on Row ${rowNum} and re-upload.`,
      });
    }
    const descKn = getVal(row, ["desc_kn"]);
    if (!descKn) {
      errors.push({
        row: rowNum,
        field: "desc_kn",
        message: `Missing data in CSV: 'desc_kn' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'desc_kn' on Row ${rowNum} and re-upload.`,
      });
    }
    const descMr = getVal(row, ["desc_mr"]);
    if (!descMr) {
      errors.push({
        row: rowNum,
        field: "desc_mr",
        message: `Missing data in CSV: 'desc_mr' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'desc_mr' on Row ${rowNum} and re-upload.`,
      });
    }
    const descPa = getVal(row, ["desc_pa"]);
    if (!descPa) {
      errors.push({
        row: rowNum,
        field: "desc_pa",
        message: `Missing data in CSV: 'desc_pa' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'desc_pa' on Row ${rowNum} and re-upload.`,
      });
    }
    const descTa = getVal(row, ["desc_ta"]);
    if (!descTa) {
      errors.push({
        row: rowNum,
        field: "desc_ta",
        message: `Missing data in CSV: 'desc_ta' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'desc_ta' on Row ${rowNum} and re-upload.`,
      });
    }

    // Specification (en)
    const specEn = getVal(row, ["spec_en", "specification_en"]);
    if (!specEn) {
      errors.push({
        row: rowNum,
        field: "spec_en",
        message: `Missing data in CSV: 'spec_en' is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'spec_en' on Row ${rowNum} and re-upload.`,
      });
    }

    // Thumbnail / Image
    const thumbRaw = getVal(row, ["thumbnailurl", "thumbnail_url", "image"]);
    const rawImagesStr = getVal(row, ["imageurls", "image_urls"]);
    const parsedImages = rawImagesStr
      ? rawImagesStr.split(/[;|,]/).map((s) => s.trim()).filter(Boolean)
      : [];
    const directThumb = convertToDirectImageUrl(thumbRaw || (parsedImages.length > 0 ? parsedImages[0] : ""));
    const directImages = Array.from(
      new Set([directThumb, ...parsedImages.map((u) => convertToDirectImageUrl(u))].filter(Boolean))
    );

    if (!directThumb && directImages.length === 0) {
      errors.push({
        row: rowNum,
        field: "thumbnailUrl",
        message: `Combo Thumbnail image is missing on Row ${rowNum}.`,
        suggestion: "Provide image URL under 'thumbnailUrl'.",
      });
    }

    // Seller Logo
    const sellerLogoRaw = getVal(row, ["sellerlogo", "seller_logo"]);
    if (!sellerLogoRaw) {
      errors.push({
        row: rowNum,
        field: "sellerLogo",
        message: `Missing data in CSV: 'sellerLogo' (Seller Brand Logo URL) is empty on Row ${rowNum}.`,
        suggestion: `Please fill in 'sellerLogo' with a valid logo image URL on Row ${rowNum} and re-upload.`,
      });
    }

    // Construct ComboProduct if valid
    if (errors.length === 0) {
      const comboId = getVal(row, ["id", "comboid", "combo_id"]) || `COMBO--${Date.now()}-${idx}`;
      const subCategoryId = getVal(row, ["subcategoryid", "subcategory_id"]) || "";
      const quantity = Math.round(Number(getVal(row, ["quantity"])) || 1);
      const gst = Number(getVal(row, ["gst"])) || 5.0;
      const bestSeller = ["true", "1", "yes"].includes(getVal(row, ["bestseller", "isbestseller"]).toLowerCase());
      const isActive = !["false", "0", "no", "inactive"].includes(getVal(row, ["isactive", "status"]).toLowerCase());

      const toLines = (str: string, fallback: string[]) => {
        if (!str) return fallback;
        const arr = str.split(/[;|\n]/).map((s) => s.trim()).filter(Boolean);
        return arr.length > 0 ? arr : fallback;
      };

      const instEn = toLines(getVal(row, ["instructions_en"]), ["Use as directed by veterinarian."]);
      const ingEn = toLines(getVal(row, ["ingredients_en"]), ["Not Applicable"]);
      const storageEn = toLines(getVal(row, ["storage_en"]), ["Room Temperature [25°C]"]);

      const comboPayload: any = {
        id: comboId,
        name: buildMultiLang(row, ["name", "combo_name"], nameEn),
        description: buildMultiLang(row, ["desc", "description"], descEn),
        best_before: buildMultiLang(row, ["best_before", "bestbefore"], getVal(row, ["best_before_en", "bestbefore_en"]) || "2 Years"),
        price,
        mrp,
        gst,
        quantity,
        quantityUnit: buildMultiLang(row, ["quantityunit", "quantity_unit"], getVal(row, ["quantityunit_en", "quantityunit"]) || "Unit"),
        weight,
        weightUnit: buildMultiLang(row, ["weightunit", "weight_unit"], getVal(row, ["weightunit_en", "weightunit"]) || "g"),
        categoryId,
        subCategoryId,
        thumbnailUrl: directThumb || directImages[0] || "",
        imageUrls: directImages.length > 0 ? directImages : [directThumb],
        sellerName: buildMultiLang(row, ["sellername", "brand"], getVal(row, ["sellername_en", "sellername"]) || "Chimertech"),
        sellerType: getVal(row, ["sellertype", "seller_type"]) || "seller",
        sellerLogo: convertToDirectImageUrl(sellerLogoRaw) || sellerLogoRaw || "",
        specification: {
          specification: buildMultiLang(row, ["spec", "specification"], specEn),
        },
        instructionsToUse: {
          en: instEn,
          hi: toLines(getVal(row, ["instructions_hi"]), instEn),
          kn: toLines(getVal(row, ["instructions_kn"]), instEn),
          mr: toLines(getVal(row, ["instructions_mr"]), instEn),
          pa: toLines(getVal(row, ["instructions_pa"]), instEn),
          ta: toLines(getVal(row, ["instructions_ta"]), instEn),
        },
        productIngredients: {
          en: ingEn,
          hi: toLines(getVal(row, ["ingredients_hi"]), ingEn),
          kn: toLines(getVal(row, ["ingredients_kn"]), ingEn),
          mr: toLines(getVal(row, ["ingredients_mr"]), ingEn),
          pa: toLines(getVal(row, ["ingredients_pa"]), ingEn),
          ta: toLines(getVal(row, ["ingredients_ta"]), ingEn),
          id: ingEn,
        },
        storageCondition: {
          en: storageEn,
          hi: toLines(getVal(row, ["storage_hi"]), storageEn),
          kn: toLines(getVal(row, ["storage_kn"]), storageEn),
          mr: toLines(getVal(row, ["storage_mr"]), storageEn),
          pa: toLines(getVal(row, ["storage_pa"]), storageEn),
          ta: toLines(getVal(row, ["storage_ta"]), storageEn),
        },
        isActive,
        bestSeller,
        updatedAt: new Date().toISOString(),
      };

      validCombos.push(comboPayload);
    }
  });

  return {
    success: errors.length === 0,
    totalRows: csvRows.length,
    validRows: validCombos.length,
    errors,
    data: errors.length === 0 ? validCombos : [],
  };
}

/**
 * SAMPLE CSV GENERATORS (6 Indian Regional Languages Included)
 */
export const SAMPLE_PRODUCTS_CSV_CONTENT = `id,name_en,name_hi,name_kn,name_mr,name_pa,name_ta,price,mrp,categoryId,subCategoryId,weight,weightUnit_en,weightUnit_hi,weightUnit_kn,weightUnit_mr,weightUnit_pa,weightUnit_ta,quantity,quantityUnit_en,quantityUnit_hi,quantityUnit_kn,quantityUnit_mr,quantityUnit_pa,quantityUnit_ta,thumbnailUrl,imageUrls,description_en,description_hi,description_kn,description_mr,description_pa,description_ta,specification_en,specification_hi,specification_kn,specification_mr,specification_pa,specification_ta,instructionsToUse_en,instructionsToUse_hi,instructionsToUse_kn,instructionsToUse_mr,instructionsToUse_pa,instructionsToUse_ta,productIngredients_en,productIngredients_hi,productIngredients_kn,productIngredients_mr,productIngredients_pa,productIngredients_ta,storageCondition_en,storageCondition_hi,storageCondition_kn,storageCondition_mr,storageCondition_pa,storageCondition_ta,bestBefore_en,bestBefore_hi,bestBefore_kn,bestBefore_mr,bestBefore_pa,bestBefore_ta,usage_en,usage_hi,sellerName_en,sellerName_hi,sellerName_kn,sellerName_mr,sellerName_pa,sellerName_ta,sellerLogo,sellerType,gst,rating,stock,bestSeller
PRD-101-BREED,AI Sheath High Quality French Type,एआई म्यान उच्च गुणवत्ता फ्रेंच प्रकार,ಎಐ ಕವಚ ಉತ್ತಮ ಗುಣಮಟ್ಟದ ಫ್ರೆಂಚ್ ಪ್ರಕಾರ,एआय शीथ उच्च दर्जाची फ्रेंच प्रकार,ਏਆਈ ਮਿਆਨ ਉੱਚ ਗੁਣਵੱਤਾ ਫ੍ਰੈਂਚ ਕਿਸਮ,ஏஐ உறை உயர் தரம் பிரெஞ்சு வகை,350,450,cat_breeding,subcat_ai_equipment,150,g,ग्राम,ಗ್ರಾಂ,ग्रॅम,ਗ੍ਰਾਮ,கிராம்,1,Unit,इकाई,ಘಟಕ,युनिट,ਯੂਨਿਟ,அலகு,https://lh3.googleusercontent.com/d/1hsGIMagKSbHlabqxiKGuxm3NVFH9AcRQ=s800,https://lh3.googleusercontent.com/d/1hsGIMagKSbHlabqxiKGuxm3NVFH9AcRQ=s800,Precision artificial insemination sheaths for cattle and buffaloes.,मवेशियों और भैंसों के लिए सटीक कृत्रिम गर्भाधान म्यान।,ಹಸುಗಳು ಮತ್ತು ಎಮ್ಮೆಗಳಿಗೆ ನಿಖರವಾದ ಕೃತಕ ಗರ್ಭಧಾರಣೆಯ ಕವಚಗಳು।,गाई आणि म्हशींसाठी अचूक कृत्रिम रेतन आवरण।,ਗਾਵਾਂ ਅਤੇ ਮੱਝਾਂ ਲਈ ਸਟੀਕ ਨਕਲੀ ਗਰਭਧਾਰਨ ਮਿਆਨ।,மாடுகள் மற்றும் எருமைகளுக்கான துல்லியமான செயற்கை கருவூட்டல் உறை।,Universal 0.25ml and 0.5ml straw compatible.,यूनिवर्सल 0.25 मिली और 0.5 मिली स्ट्रॉ संगत।,ಸಾರ್ವತ್ರಿಕ 0.25 ಮಿಲಿ ಮತ್ತು 0.5 ಮಿಲಿ ಸ್ಟ್ರಾ ಹೊಂದಾಣಿಕೆ।,युनिव्हर्सल 0.25 मिली आणि 0.5 मिली स्ट्रॉ सुसंगत।,ਯੂਨੀਵਰਸਲ 0.25 ਮਿਲੀਲੀਟਰ ਅਤੇ 0.5 ਮਿਲੀਲੀਟਰ ਸਟ੍ਰਾ ਅਨੁਕੂਲ।,யுனிவர்சல் 0.25 மி.லி மற்றும் 0.5 மி.லி ஸ்ட்ரா பொருந்தும்।,Use with standard French mini A.I. gun under sterile condition.,बाँझ स्थिति में मानक फ्रेंच मिनी एआई गन के साथ प्रयोग करें।,ಕ್ರಿಮಿಮುಕ್ತ ಸ್ಥಿತಿಯಲ್ಲಿ ಪ್ರಮಾಣಿತ ಫ್ರೆಂಚ್ ಮಿನಿ ಎಐ ಗನ್‌ನೊಂದಿಗೆ ಬಳಸಿ।,जंतुविरहित स्थितीत मानक फ्रेंच मिनी एआय गनसह वापरा।,ਨਿਰਜੀਵ ਸਥਿਤੀ ਵਿੱਚ ਮਿਆਰੀ ਫ੍ਰੈਂਚ ਮਿੰਨੀ ਏਆਈ ਗਨ ਨਾਲ ਵਰਤੋ।,மலட்டு நிலையில் நிலையான பிரெஞ்சு மினி ஏஐ துப்பாக்கியுடன் பயன்படுத்தவும்।,Medical grade non-toxic polymers.,मेडिकल ग्रेड गैर-विषाक्त पॉलिमर।,ವೈದ್ಯಕೀಯ ದರ್ಜೆಯ ವಿಷಕಾರಿಯಲ್ಲದ ಪಾಲಿಮರ್‌ಗಳು।,वैद्यकीय दर्जाचे गैर-विषारी पॉलिमर।,ਮੈਡੀਕਲ ਗ੍ਰੇਡ ਗੈਰ-ਜ਼ਹਿਰੀਲੇ ਪੋਲੀਮਰ।,மருத்துவ தரம் கொண்ட நச்சுத்தன்மையற்ற பாலிமர்கள்।,Store in a dry room temperature place away from dust.,धूल से दूर सूखे कमरे के तापमान पर स्टोर करें।,ಧೂಳಿನಿಂದ ದೂರವಿರುವ ಕೋಣೆಯ ಉಷ್ಣಾಂಶದಲ್ಲಿ ಸಂಗ್ರಹಿಸಿ।,धुळीपासून दूर कोरड्या खोलीच्या तापमानावर ठेवा।,ਧੂੜ ਤੋਂ ਦੂਰ ਸੁੱਕੇ ਕਮਰੇ ਦੇ ਤਾਪਮਾਨ ਤੇ ਸਟੋਰ ਕਰੋ।,தூசி இல்லாத உலர்ந்த அறை வெப்பநிலையில் சேமிக்கவும்।,3 Years,3 वर्ष,3 ವರ್ಷಗಳು,३ वर्षे,3 ਸਾਲ,3 ஆண்டுகள்,Artificial Insemination,कृत्रिम गर्भाधान,Chimertech,कायेमरटेक,ಕೈಮರ್‌ಟೆಕ್,कायमरटेक,ਕਾਈਮਰਟੈਕ,சைமர்டெக்,https://lh3.googleusercontent.com/d/1x72e_nlxXIzwHtgzvXcGFReKwgOBAIP4=s800,seller,5,4.8,150,true
PRD-102-DISEASE,Mastitis CMT Kit 1L with 4-Cup Paddle,मस्टाइटिस सीएमटी किट 1 लीटर पैडल के साथ,ಮ್ಯಾಸ್ಟೈಟಿಸ್ ಸಿಎಂಟಿ ಕಿಟ್ 1 ಲೀಟರ್ ಪ್ಯಾಡಲ್‌ನೊಂದಿಗೆ,मॅस्टायटिस सीएमटी किट १ लिटर पॅडलसह,ਮਾਸਟਾਈਟਿਸ ਸੀਐਮਟੀ ਕਿੱਟ 1 ਲੀਟਰ ਪੈਡਲ ਨਾਲ,மாஸ்டிடிஸ் சிஎம்டி கிட் 1 லிட்டர் துடுப்புடன்,999,1299,cat_disease_management,subcat_disease_detection,1100,g,ग्राम,ಗ್ರಾಂ,ग्रॅम,ਗ੍ਰਾਮ,கிராம்,1,Unit,इकाई,ಘಟಕ,युनिट,ਯੂਨਿਟ,அலகு,https://lh3.googleusercontent.com/d/1hsGIMagKSbHlabqxiKGuxm3NVFH9AcRQ=s800,https://lh3.googleusercontent.com/d/1hsGIMagKSbHlabqxiKGuxm3NVFH9AcRQ=s800,Rapid on-farm subclinical mastitis detection reagent with 4-well test paddle.,4-वेल परीक्षण पैडल के साथ तेजी से सबक्लिनिकल मस्टाइटिस पहचान अभिकर्मक।,4-ವೆಲ್ ಪರೀಕ್ಷಾ ಪ್ಯಾಡಲ್‌ನೊಂದಿಗೆ ಕ್ಷಿಪ್ರ ಸಬ್‌ಕ್ಲಿನಿಕಲ್ ಮ್ಯಾಸ್ಟೈಟಿಸ್ ಪತ್ತೆ ಕಾರಕ।,4-वेल चाचणी पॅडलसह जलद सबक्लिनिकल मॅस्टायटिस शोध अभिकर्मक।,4-ਵੈੱਲ ਟੈਸਟ ਪੈਡਲ ਨਾਲ ਤੇਜ਼ ਸਬਕਲੀਨਿਕਲ ਮਾਸਟਾਈਟਿਸ ਖੋਜ ਰੀਐਜੈਂਟ।,4-வெல் சோதனைத் துடுப்புடன் கூடிய விரைவான சப்-கிளினிக்கல் மாஸ்டிடிஸ் கண்டறிதல் மறுஉருவாக்கி।,Includes 1000ml reagent with 4-cup testing paddle.,4-कप परीक्षण पैडल के साथ 1000 मिलीलीटर अभिकर्मक शामिल है।,4-ಕಪ್ ಪರೀಕ್ಷಾ ಪ್ಯಾಡಲ್‌ನೊಂದಿಗೆ 1000 ಮಿಲಿ ಕಾರಕವನ್ನು ಒಳಗೊಂಡಿದೆ।,4-कप चाचणी पॅडलसह 1000 मिली अभिकर्मक समाविष्ट आहे।,4-ਕੱਪ ਟੈਸਟਿੰਗ ਪੈਡਲ ਨਾਲ 1000 ਮਿਲੀਲੀਟਰ ਰੀਐਜੈਂਟ ਸ਼ਾਮਲ ਹੈ।,4-கப் சோதனைத் துடுப்புடன் 1000 மி.லி மறுஉருவாக்கி அடங்கும்।,Squirt milk sample into paddle wells and add equal reagent. Swirl gently for 10 seconds.,पैडल कप में दूध का नमूना डालें और बराबर अभिकर्मक मिलाएं। 10 सेकंड के लिए हिलाएं।,ಪ್ಯಾಡಲ್ ಕಪ್‌ಗಳಿಗೆ ಹಾಲಿನ ಮಾದರಿ ಹಾಕಿ ಸಮಾನ ಕಾರಕ ಸೇರಿಸಿ 10 ಸೆಕೆಂಡುಗಳ ಕಾಲ ತಿರುಗಿಸಿ।,पॅडल कपमध्ये दुधाचा नमुना टाका आणि समान अभिकर्मक घाला. 10 सेकंद हलवा।,ਪੈਡਲ ਕੱਪਾਂ ਵਿੱਚ ਦੁੱਧ ਦਾ ਨਮੂਨਾ ਪਾਓ ਅਤੇ ਬਰਾਬਰ ਰੀਐਜੈਂਟ ਮਿਲਾਓ। 10 ਸਕਿੰਟ ਹਿਲਾਓ।,துடுப்பு கோப்பைகளில் பால் மாதிரி இட்டு சம அளவு மறுஉருவாக்கி சேர்த்து 10 விநாடிகள் சுழற்றவும்।,Alkyl aryl sulfonate indicator solution.,अल्काइल एरिल सल्फोनेट संकेतक समाधान।,ಆಲ್ಕೈಲ್ ಆರಿಲ್ ಸಲ್ಫೋನೇಟ್ ಸೂಚಕ ದ್ರಾವಣ।,अल्काइल एरिल सल्फोनेट इंडिकेटर द्रावण।,ਐਲਕਾਈਲ ਆਰਿਲ ਸਲਫੋਨੇਟ ਸੂਚਕ ਘੋਲ।,அல்கைல் அரில் சல்போனேட் காட்டி கரைசல்।,Store in cool dark area between 10C and 30C.,10C और 30C के बीच ठंडी और अंधेरी जगह में स्टोर करें।,10C ಮತ್ತು 30C ನಡುವಿನ ತಂಪಾದ ಕತ್ತಲೆಯ ಸ್ಥಳದಲ್ಲಿ ಸಂಗ್ರಹಿಸಿ।,10C आणि 30C दरम्यान थंड आणि गडद भागात ठेवा।,10C ਅਤੇ 30C ਦੇ ਵਿਚਕਾਰ ਠੰਡੀ ਅਤੇ ਹਨੇਰੀ ਥਾਂ ਤੇ ਸਟੋਰ ਕਰੋ।,10C மற்றும் 30C இடையே குளிர்ந்த இருண்ட பகுதியில் சேமிக்கவும்।,2 Years,2 वर्ष,2 वर्षಗಳು,२ वर्षे,2 ਸਾਲ,2 ஆண்டுகள்,Disease Detection,रोग पहचान,Chimertech,कायेमरटेक,ಕೈಮರ್‌ಟೆಕ್,कायमरटेक,ਕਾਈਮਰਟੈਕ,சைமர்டெக்,https://lh3.googleusercontent.com/d/1x72e_nlxXIzwHtgzvXcGFReKwgOBAIP4=s800,seller,5,4.9,200,true
PRD-103-NUTRITION,Chelated Mineral Mixture Calcium Booster 1kg,चिलेटेड खनिज मिश्रण कैल्शियम बूस्टर 1 किग्रा,ಚೆಲೇಟೆಡ್ ಖನಿಜ ಮಿಶ್ರಣ ಕ್ಯಾಲ್ಸಿಯಂ ಬೂಸ್ಟರ್ 1 ಕೆಜಿ,चिलेटेड खनिज मिश्रण कॅल्शियम बूस्टर १ किलो,ਚੀਲੇਟਿਡ ਖਣਿਜ ਮਿਸ਼ਰਣ ਕੈਲਸ਼ੀਅਮ ਬੂਸਟਰ 1 ਕਿਲੋ,செலேட்டட் மினரல் கலவை கால்சியம் பூஸ்டர் 1 கிலோ,280,360,cat_nutrition,subcat_nutrition_supplement,1000,g,ग्राम,ಗ್ರಾಂ,ग्रॅम,ਗ੍ਰਾਮ,கிராம்,1,Unit,इकाई,ಘಟಕ,युनिट,ਯੂਨਿਟ,அலகு,https://lh3.googleusercontent.com/d/1hsGIMagKSbHlabqxiKGuxm3NVFH9AcRQ=s800,https://lh3.googleusercontent.com/d/1hsGIMagKSbHlabqxiKGuxm3NVFH9AcRQ=s800,Fortified minerals and vitamins to maximize daily milk yield and cattle fertility.,दैनिक दूध उत्पादन और प्रजनन क्षमता को अधिकतम करने के लिए फोर्टिफाइड खनिज और विटामिन।,ದೈನಂದಿನ ಹಾಲಿನ ಇಳುವರಿ ಮತ್ತು ಜಾನುವಾರು ಫಲವತ್ತತೆಯನ್ನು ಹೆಚ್ಚಿಸಲು ಬಲವರ್ಧಿತ ಖನಿಜಗಳು ಮತ್ತು ಜೀವಸತ್ವಗಳು।,दैनंदिन दुधाचे प्रमाण आणि जनावरांची प्रजनन क्षमता वाढवण्यासाठी समृद्ध खनिजे आणि जीवनसत्त्वे।,ਰੋਜ਼ਾਨਾ ਦੁੱਧ ਦੀ ਪੈਦਾਵਾਰ ਅਤੇ ਪਸ਼ੂਆਂ ਦੀ ਪ੍ਰਜਨਨ ਸਮਰੱਥਾ ਨੂੰ ਵਧਾਉਣ ਲਈ ਮਜ਼ਬੂਤ ਖਣਿਜ ਅਤੇ ਵਿਟਾਮਿਨ।,தினசரி பால் உற்பத்தியை அதிகரிக்க செறிவூட்டப்பட்ட தாதுக்கள் மற்றும் வைட்டமின்கள்।,Contains Chelated Zinc Copper Calcium Phosphorus and Chromium.,चिलेटेड जिंक कॉपर कैल्शियम फास्फोरस और क्रोमियम शामिल हैं।,ಚೆಲೇಟೆಡ್ ಸತು ತಾಮ್ರ ಕ್ಯಾಲ್ಸಿಯಂ ರಂಜಕ ಮತ್ತು ಕ್ರೋಮಿಯಂ ಒಳಗೊಂಡಿದೆ।,चिलेटेड झिंक तांबे कॅल्शियम फॉस्ಫರस आणि क्रोमियम समाविष्ट आहे।,ਚੀਲੇਟਿਡ ਜ਼ਿੰਕ ਤਾਂਬਾ ਕੈਲਸ਼ੀਅਮ ਫਾਸਫੋਰਸ ਅਤੇ ਕ੍ਰੋਮੀਅਮ ਸ਼ਾਮਲ ਹੈ।,செலேட்டட் துத்தநாகம் தாமிரம் கால்சியம் பாஸ்பரஸ் மற்றும் குரோமியம் கொண்டது।,Feed 50 grams daily mixed with cattle feed or fodder.,पशु आहार या चारे के साथ मिलाकर प्रतिदिन 50 ग्राम खिलाएं।,ಜಾನುವಾರು ಆಹಾರ ಅಥವಾ ಮೇವಿನೊಂದಿಗೆ ಬೆರೆಸಿ ಪ್ರತಿದಿನ 50 ಗ್ರಾಂ ತಿನ್ನಿಸಿ।,जनावरांच्या चाऱ्यात मिसळून दररोज 50 ग्रॅम खायला द्यावे।,ਰੋਜ਼ਾਨਾ 50 ਗ੍ਰਾਮ ਪਸ਼ੂਆਂ ਦੀ ਖੁਰਾਕ ਜਾਂ ਚਾਰੇ ਵਿੱਚ ਮਿਲਾ ਕੇ ਖੁਆਓ।,கால்நடை தீவனம் அல்லது புல்லுடன் கலந்து தினமும் 50 கிராம் உணவளிக்கவும்।,Calcium Phosphorus Magnesium Chelated Trace Minerals Vitamin AD3E.,कैल्शियम फास्फोरस मैग्नीशियम चिलेटेड ट्रेस खनिज विटामिन AD3E।,ಕ್ಯಾಲ್ಸಿಯಂ ರಂಜಕ ಮೆಗ್ನೀಸಿಯಮ್ ಚೆಲೇಟೆಡ್ ಖನಿಜಗಳು ವಿಟಮಿನ್ AD3E।,कॅल्शियम फॉस्ಫರस मॅग्नेशियम चिलेटेड खनिजे व्हिटॅमिन AD3E।,ਕੈਲਸ਼ੀਅਮ ਫਾਸਫੋਰਸ ਮੈਗਨੀਸ਼ੀਅਮ ਚੀਲੇਟਿਡ ਖਣਿਜ ਵਿਟਾਮਿਨ AD3E।,கால்சியம் பாஸ்பரஸ் மெக்னீசியம் செலேட்டட் தாதுக்கள் வைட்டமின் AD3E।,Store tightly sealed in dry and cool place.,सूखे और ठंडे स्थान पर कसकर सील करके स्टोर करें।,ಶುಷ್ಕ ಮತ್ತು ತಂಪಾದ ಸ್ಥಳದಲ್ಲಿ ಬಿಗಿಯಾಗಿ ಮುಚ್ಚಿ ಸಂಗ್ರಹಿಸಿ।,कोरड्या आणि थंड जागी घट्ट बंद करून ठेवा।,ਸੁੱਕੀ ਅਤੇ ਠੰਡੀ ਜਗ੍ਹਾ ਤੇ ਚੰਗੀ ਤਰ੍ਹਾਂ ਸੀਲ ਕਰਕੇ ਸਟੋਰ ਕਰੋ।,உலர்ந்த மற்றும் குளிர்ந்த இடத்தில் இறுக்கமாக மூடி வைக்கவும்।,18 Months,18 महीने,18 ತಿಂಗಳು,१८ महिने,18 ਮਹੀਨੇ,18 மாதங்கள்,Daily Feed Supplement,दैनिक आहार पूरक,Chimertech,कायेमरटेक,ಕೈಮರ್‌ಟೆಕ್,कायमरटेक,ਕਾਈਮਰਟੈਕ,சைமர்டெக்,https://lh3.googleusercontent.com/d/1x72e_nlxXIzwHtgzvXcGFReKwgOBAIP4=s800,seller,5,4.7,500,false
`;

export const SAMPLE_COMBOS_CSV_CONTENT = `id,name_en,name_hi,name_kn,name_mr,name_pa,name_ta,price,mrp,categoryId,subCategoryId,weight,weightUnit_en,weightUnit_hi,weightUnit_kn,weightUnit_mr,weightUnit_pa,weightUnit_ta,quantity,quantityUnit_en,quantityUnit_hi,quantityUnit_kn,quantityUnit_mr,quantityUnit_pa,quantityUnit_ta,thumbnailUrl,imageUrls,desc_en,desc_hi,desc_kn,desc_mr,desc_pa,desc_ta,spec_en,spec_hi,spec_kn,spec_mr,spec_pa,spec_ta,instructions_en,instructions_hi,instructions_kn,instructions_mr,instructions_pa,instructions_ta,ingredients_en,ingredients_hi,ingredients_kn,ingredients_mr,ingredients_pa,ingredients_ta,storage_en,storage_hi,storage_kn,storage_mr,storage_pa,storage_ta,best_before_en,best_before_hi,best_before_kn,best_before_mr,best_before_pa,best_before_ta,sellerName_en,sellerName_hi,sellerName_kn,sellerName_mr,sellerName_pa,sellerName_ta,sellerLogo,sellerType,gst,bestSeller,isActive
COMBO-01-MASTITIS,Complete Mastitis Detection and Care Combo Pack,मास्टाइटिस रोकथाम और उपचार कॉम्बो,ಸಂಪೂರ್ಣ ಮ್ಯಾಸ್ಟೈಟಿಸ್ ತಡೆಗಟ್ಟುವಿಕೆ ಮತ್ತು ಆರೈಕೆ ಕಾಂಬೊ,संपूर्ण मॅस्टायटिस प्रतिबंध आणि काळजी कॉम्बो,ਸੰਪੂਰਨ ਮਾਸਟਾਈਟਿਸ ਰੋਕਥਾਮ ਅਤੇ ਦੇਖਭਾਲ ਕੰਬੋ,முழுமையான மாஸ்டிடிஸ் தடுப்பு மற்றும் பராமரிப்பு காம்போ,1499,1899,cat_disease_management,subcat_disease_detection,1500,g,ग्राम,ಗ್ರಾಂ,ग्रॅम,ਗ੍ਰਾਮ,கிராம்,1,Unit,इकाई,ಘಟಕ,युनिट,ਯੂਨਿਟ,அலகு,https://lh3.googleusercontent.com/d/1hsGIMagKSbHlabqxiKGuxm3NVFH9AcRQ=s800,https://lh3.googleusercontent.com/d/1hsGIMagKSbHlabqxiKGuxm3NVFH9AcRQ=s800,All-in-one pack containing CMT reagent paddle and herbal udder wash spray for complete mastitis defense.,मास्टाइटिस की संपूर्ण रोकथाम के लिए सीएमटी अभिकर्मक पैडल और हर्बल स्प्रे का कॉम्बो पैक।,ಮ್ಯಾಸ್ಟೈಟಿಸ್‌ನಿಂದ ಸಂಪೂರ್ಣ ರಕ್ಷಣೆಗಾಗಿ ಸಿಎಂಟಿ ಕಾರಕ ಪ್ಯಾಡಲ್ ಮತ್ತು ಗಿಡಮೂಲಿಕೆ ಕೆಚ್ಚಲು ವಾಶ್ ಸ್ಪ್ರೇ ಕಾಂಬೊ ಪ್ಯಾಕ್।,मॅस्टायटिसच्या संपूर्ण संरक्षणासाठी सीएमटी अभिकर्मक पॅडल आणि हर्बल कास वॉश स्प्रेचा कॉम्बो पॅक।,ਮਾਸਟਾਈਟਿਸ ਦੀ ਸੰਪੂਰਨ ਰੋਕਥਾਮ ਲਈ ਸੀਐਮਟੀ ਰੀਐਜੈਂਟ ਪੈਡਲ ਅਤੇ ਹਰਬਲ ਸਪਰੇਅ ਦਾ ਕੰਬੋ ਪੈਕ।,மாஸ்டிடிஸை முழுமையாகத் தடுக்க சிஎம்டி மறுஉருவாக்கி துடுப்பு மற்றும் மூலிகை மடி கழுவும் ஸ்ப்ரே காம்போ பேக்।,Includes CMT 1 Litre Reagent 4-cup Paddle and 500ml Udder spray.,सीएमटी 1 लीटर अभिकर्मक 4-कप पैडल और 500 मिलीलीटर स्प्रे शामिल है।,ಸಿಎಂಟಿ 1 ಲೀಟರ್ ಕಾರಕ 4-ಕಪ್ ಪ್ಯಾಡಲ್ ಮತ್ತು 500 ಮಿಲಿ ಸ್ಪ್ರೇ ಒಳಗೊಂಡಿದೆ।,सीएमटी १ लिटर अभिकर्मक ४-कप पॅडल आणि ५०० मिली स्प्रे समाविष्ट आहे।,ਸੀਐਮਟੀ 1 ਲੀਟਰ ਰੀਐਜੈਂਟ 4-ਕੱਪ ਪੈਡਲ ਅਤੇ 500 ਮਿਲੀਲੀਟਰ ਸਪਰੇਅ ਸ਼ਾਮਲ ਹੈ।,சிஎம்டி 1 லிட்டர் மறுஉருவாக்கி 4-கப் துடுப்பு மற்றும் 500 மி.லி ஸ்ப்ரே கொண்டது।,Use CMT paddle once weekly. Spray udder after every milking.,सप्ताह में एक बार सीएमटी पैडल का प्रयोग करें। हर दुहने के बाद थनों पर स्प्रे करें।,ವಾರಕ್ಕೊಮ್ಮೆ ಸಿಎಂಟಿ ಪ್ಯಾಡಲ್ ಬಳಸಿ. ಪ್ರತಿ ಹಾಲು ಹಿಂಡಿದ ನಂತರ ಕೆಚ್ಚಲಿಗೆ ಸ್ಪ್ರೇ ಮಾಡಿ.,आठवड्यातून एकदा सीएमटी पॅडल वापरा. प्रत्येक दूध काढणीनंतर कासेवर स्प्रे करा.,ਹਫ਼ਤੇ ਵਿੱਚ ਇੱਕ ਵਾਰ ਸੀਐਮਟੀ ਪੈਡਲ ਦੀ ਵਰਤੋਂ ਕਰੋ। ਹਰ ਦੁੱਧ ਚੋਣ ਤੋਂ ਬਾਅਦ ਥਣਾਂ ਤੇ ਸਪਰੇਅ ਕਰੋ।,வாரத்திற்கு ஒரு முறை சிஎம்டி துடுப்பைப் பயன்படுத்தவும். ஒவ்வொரு கறவைக்குப் பிறகும் மடியில் ஸ்ப்ரே செய்யவும்।,Veterinary grade reagent and natural herbal extracts.,पशु चिकित्सा ग्रेड अभिकर्मक और प्राकृतिक हर्बल अर्क।,ಪಶುವೈದ್ಯಕೀಯ ದರ್ಜೆಯ ಕಾರಕ ಮತ್ತು ನೈಸರ್ಗಿಕ ಗಿಡಮೂಲಿಕೆ ಸಾರಗಳು।,पशुवैद्यकीय दर्जाचे अभिकर्मक आणि नैसर्गिक हर्बल अर्क।,ਪਸ਼ੂ ਚਿਕਿਤਸਾ ਗ੍ਰੇਡ ਰੀਐਜੈਂਟ ਅਤੇ ਕੁਦਰਤੀ ਜੜੀ-ਬੂਟੀਆਂ ਦੇ ਅਰਕ।,கால்நடை தர மறுஉருவாக்கி மற்றும் இயற்கை மூலிகை சாறுகள்।,Store at room temperature 25C.,25C कमरे के तापमान पर स्टोर करें।,25C ಕೋಣೆಯ ಉಷ್ಣಾಂಶದಲ್ಲಿ ಸಂಗ್ರಹಿಸಿ।,25C खोलीच्या तापमानावर ठेवा।,25C ਕਮਰੇ ਦੇ ਤਾਪਮਾਨ ਤੇ ਸਟੋਰ ਕਰੋ।,25C அறை வெப்பநிலையில் சேமிக்கவும்।,2 Years,2 वर्ष,2 ವರ್ಷಗಳು,२ वर्षे,2 ਸਾਲ,2 ஆண்டுகள்,Chimertech,कायेमरटेक,ಕೈಮರ್‌ಟೆಕ್,कायमरटेक,ਕਾਈਮਰਟੈਕ,சைமர்டெக்,https://lh3.googleusercontent.com/d/1x72e_nlxXIzwHtgzvXcGFReKwgOBAIP4=s800,seller,5,true,true
COMBO-02-BREEDING,AI Master Artificial Insemination Starter Bundle,एआई मास्टर कृत्रिम गर्भाधान स्टार्टर बंडल,ಎಐ ಮಾಸ್ಟರ್ ಕೃತಕ ಗರ್ಭಧಾರಣೆಯ ಆರಂಭಿಕ ಬಂಡಲ್,एआय मास्टर कृत्रिम रेतन स्टार्टर बंडल,ਏਆਈ ਮਾਸਟਰ ਨਕਲੀ ਗਰਭਧਾਰਨ ਸਟਾਰਟਰ ਬੰਡਲ,ஏஐ மாஸ்டர் செயற்கை கருவூட்டல் தொடக்க தொகுப்பு,2199,2799,cat_breeding,subcat_ai_equipment,1800,g,ग्राम,ಗ್ರಾಂ,ग्रॅम,ਗ੍ਰਾਮ,கிராம்,1,Unit,इकाई,ಘಟಕ,युनिट,ਯੂਨਿਟ,அலகு,https://lh3.googleusercontent.com/d/1hsGIMagKSbHlabqxiKGuxm3NVFH9AcRQ=s800,https://lh3.googleusercontent.com/d/1hsGIMagKSbHlabqxiKGuxm3NVFH9AcRQ=s800,Complete AI kit including stainless steel AI gun 100 sheaths thawing flask and shoulder gloves.,स्टेनलेस स्टील एआई गन 100 म्यान और शोल्डर दस्ताने सहित पूरा एआई किट।,ಸ್ಟೇನ್‌ಲೆಸ್ ಸ್ಟೀಲ್ ಎಐ ಗನ್ 100 ಕವಚಗಳು ಮತ್ತು ಭುಜದ ಕೈಗವಸುಗಳನ್ನು ಒಳಗೊಂಡಿರುವ ಸಂಪೂರ್ಣ ಎಐ ಕಿಟ್।,स्टेनलेस स्टील एआय गन १०० शीथ आणि शोल्डर ग्लोव्हजसह संपूर्ण एआय किट।,ਸਟੇਨਲੈਸ ਸਟੀਲ ਏਆਈ ਗਨ 100 ਮਿਆਨ ਅਤੇ ਮੋਢੇ ਦੇ ਦਸਤਾਨੇ ਸਮੇਤ ਪੂਰੀ ਏਆਈ ਕਿੱਟ।,துருப்பிடிக்காத எஃகு ஏஐ துப்பாக்கி 100 உறைகள் மற்றும் தோள்பட்டை கையுறைகள் அடங்கிய முழுமையான ஏஐ கிட்।,Universal French type gun with digital thermometer thaw flask.,डिजिटल थर्मामीटर फ्लास्क के साथ यूनिवर्सल फ्रेंच प्रकार की बंदूक।,ಡಿಜಿಟಲ್ ಥರ್ಮಾಮೀಟರ್ ಫ್ಲಾಸ್ಕ್‌ನೊಂದಿಗೆ ಸಾರ್ವತ್ರಿಕ ಫ್ರೆಂಚ್ ಪ್ರಕಾರದ ಗನ್।,डिजिटल थर्मामीटर फ्लास्कसह युनिव्हर्सल फ्रेंच प्रकारची बंदूक।,ਡਿਜੀਟਲ ਥਰਮਾਮੀਟਰ ਫਲਾਸਕ ਨਾਲ ਯੂਨੀਵਰਸਲ ਫ੍ਰੈਂਚ ਕਿਸਮ ਦੀ ਬੰਦੂਕ।,டிஜிட்டல் தெர்மோமீட்டர் பிளாஸ்க்குடன் கூடிய உலகளாவிய பிரெஞ்சு வகை துப்பாக்கி।,Follow standard hygienic AI protocol for bovine cattle.,गोजातीय मवेशियों के लिए मानक स्वच्छ एआई प्रोटोकॉल का पालन करें।,ಜಾನುವಾರುಗಳಿಗೆ ಪ್ರಮಾಣಿತ ನೈರ್ಮಲ್ಯದ ಎಐ ಪ್ರೋಟೋಕಾಲ್ ಅನುಸರಿಸಿ।,गाई-म्हशींसाठी मानक स्वच्छ एआय प्रोटोकॉलचे अनुसरण करा।,ਪਸ਼ੂਆਂ ਲਈ ਮਿਆਰੀ ਸਵੱਛ ਏਆਈ ਪ੍ਰੋਟੋਕੋਲ ਦੀ ਪਾਲਣਾ ਕਰੋ।,கால்நடைகளுக்கான நிலையான சுகாதாரமான ஏஐ வழிகாட்டுதலைப் பின்பற்றவும்।,Stainless steel 304 and sterile polyethylene.,स्टेनलेस स्टील 304 और बाँझ पॉलीथीन।,ಸ್ಟೇನ್‌ಲೆಸ್ ಸ್ಟೀಲ್ 304 ಮತ್ತು ಕ್ರಿಮಿಮುಕ್ತ ಪಾಲಿಥಿಲೀನ್।,स्टेनलेस स्टील ३०४ आणि निर्जंतुक पॉलिथिलीन।,ਸਟੇਨਲੈਸ ਸਟੀਲ 304 ਅਤੇ ਨਿਰਜੀਵ ਪੋਲੀਥੀਲੀਨ।,துருப்பிடிக்காத எஃகு 304 மற்றும் மலட்டு பாலிஎதிலீன்।,Keep in sanitized carry case in dry room.,सूखे कमरे में सेनिटाइज कैरी केस में रखें।,ಶುಷ್ಕ ಕೋಣೆಯಲ್ಲಿ ಸ್ವಚ್ಛಗೊಳಿಸಿದ ಕ್ಯಾರಿ ಕೇಸ್‌ನಲ್ಲಿ ಇರಿಸಿ।,कोरड्या खोलीत सॅनिटाइज्ड कॅरी केसमध्ये ठेवा।,ਸੁੱਕੇ ਕਮਰੇ ਵਿੱਚ ਸੈਨੀਟਾਈਜ਼ ਕੈਰੀ ਕੇਸ ਵਿੱਚ ਰੱਖੋ।,உலர்ந்த அறையில் கிருமி நீக்கம் செய்யப்பட்ட பெட்டியில் வைக்கவும்।,3 Years,3 वर्ष,3 ವರ್ಷಗಳು,३ वर्षे,3 ਸਾਲ,3 ஆண்டுகள்,Chimertech,कायेमरटेक,ಕೈಮರ್‌ಟೆಕ್,कायमरटेक,ਕਾਈਮਰਟੈਕ,சைமர்டெக்,https://lh3.googleusercontent.com/d/1x72e_nlxXIzwHtgzvXcGFReKwgOBAIP4=s800,seller,5,true,true
`;

/**
 * Triggers a browser download of the sample CSV template with UTF-8 BOM
 */
export function downloadSampleCsv(type: "products" | "combos") {
  const content = type === "products" ? SAMPLE_PRODUCTS_CSV_CONTENT : SAMPLE_COMBOS_CSV_CONTENT;
  const filename = type === "products" ? "products_bulk_upload_sample.csv" : "combos_bulk_upload_sample.csv";
  
  // Use UTF-8 BOM (\uFEFF) so Microsoft Excel & Google Sheets correctly render all 6 Indian scripts
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
