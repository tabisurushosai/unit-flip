type UnitOption = {
  label: string;
  value: string;
};

type UnitValue = UnitOption["value"];

type Category = {
  label: string;
  value: string;
  units: UnitOption[];
};

type CategoryValue = Category["value"];

type LinearConversion = {
  toBaseFactor: number;
};

type AffineConversion = {
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
};

type ConversionDefinition = LinearConversion | AffineConversion;

type StoredSelection = {
  category?: CategoryValue;
  fromUnit?: UnitValue;
  toUnit?: UnitValue;
};

const STORAGE_KEY_LAST_SELECTION = "unitFlipLastSelection";

const categories: Category[] = [
  {
    label: "長さ",
    value: "length",
    units: [
      { label: "メートル", value: "m" },
      { label: "キロメートル", value: "km" },
      { label: "センチメートル", value: "cm" },
      { label: "インチ", value: "in" },
      { label: "フィート", value: "ft" },
    ],
  },
  {
    label: "重さ",
    value: "weight",
    units: [
      { label: "グラム", value: "g" },
      { label: "キログラム", value: "kg" },
      { label: "ポンド", value: "lb" },
      { label: "オンス", value: "oz" },
    ],
  },
  {
    label: "温度",
    value: "temperature",
    units: [
      { label: "摂氏", value: "c" },
      { label: "華氏", value: "f" },
      { label: "ケルビン", value: "k" },
    ],
  },
  {
    label: "体積",
    value: "volume",
    units: [
      { label: "リットル", value: "l" },
      { label: "ミリリットル", value: "ml" },
      { label: "立方メートル", value: "m3" },
      { label: "ガロン", value: "gal" },
    ],
  },
];

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App container was not found.");
}

app.replaceChildren(createPopup());

function createPopup(): HTMLElement {
  const root = document.createElement("main");
  root.style.display = "grid";
  root.style.gap = "12px";

  const categorySelect = createSelect(
    "category",
    categories.map(({ label, value }) => ({ label, value })),
  );
  const input = createNumberInput("inputValue", "0");
  const fromSelect = createSelect("fromUnit", []);
  const output = createOutput("outputValue");
  const toSelect = createSelect("toUnit", []);
  const swapButton = createSwapButton();

  const syncUnitOptions = (
    preferredFromUnit = fromSelect.value,
    preferredToUnit = toSelect.value,
  ) => {
    const category =
      categories.find(({ value }) => value === categorySelect.value) ??
      categories[0];

    replaceOptions(fromSelect, category.units);
    replaceOptions(toSelect, category.units);

    fromSelect.value = getValidUnitValue(
      category,
      preferredFromUnit,
      category.units[0]?.value ?? "",
    );
    toSelect.value = getValidUnitValue(
      category,
      preferredToUnit,
      category.units[1]?.value ?? category.units[0]?.value ?? "",
    );
  };

  const saveSelection = () => {
    void saveStoredSelection({
      category: categorySelect.value,
      fromUnit: fromSelect.value,
      toUnit: toSelect.value,
    });
  };

  const updateConversion = () => {
    if (input.value === "") {
      output.value = "";
      return;
    }

    const inputValue = input.valueAsNumber;
    if (!Number.isFinite(inputValue)) {
      output.value = "";
      return;
    }

    const result = convertUnit(
      inputValue,
      categorySelect.value,
      fromSelect.value,
      toSelect.value,
    );
    output.value = formatConversionResult(result);
  };

  categorySelect.addEventListener("change", () => {
    syncUnitOptions();
    updateConversion();
    saveSelection();
  });
  input.addEventListener("input", updateConversion);
  fromSelect.addEventListener("change", () => {
    updateConversion();
    saveSelection();
  });
  toSelect.addEventListener("change", () => {
    updateConversion();
    saveSelection();
  });
  swapButton.addEventListener("click", () => {
    const currentFromUnit = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = currentFromUnit;
    updateConversion();
    saveSelection();
  });

  syncUnitOptions();
  updateConversion();
  void restoreStoredSelection(categorySelect, (storedSelection) => {
    syncUnitOptions(storedSelection.fromUnit, storedSelection.toUnit);
    updateConversion();
  });

  root.append(
    createField("カテゴリ", categorySelect),
    createField("入力", input),
    createField("変換元", fromSelect),
    swapButton,
    createField("出力", output),
    createField("変換先", toSelect),
  );

  return root;
}

function createField(labelText: string, control: HTMLElement): HTMLElement {
  const label = document.createElement("label");
  label.style.display = "grid";
  label.style.gap = "4px";
  label.style.fontSize = "12px";
  label.style.fontWeight = "600";

  const text = document.createElement("span");
  text.textContent = labelText;

  label.append(text, control);
  return label;
}

function createSelect(name: string, options: UnitOption[]): HTMLSelectElement {
  const select = document.createElement("select");
  select.name = name;
  select.style.minHeight = "34px";
  select.style.font = "inherit";
  select.style.width = "100%";
  replaceOptions(select, options);

  return select;
}

function createNumberInput(name: string, placeholder: string): HTMLInputElement {
  const input = document.createElement("input");
  input.name = name;
  input.inputMode = "decimal";
  input.placeholder = placeholder;
  input.type = "number";
  input.style.boxSizing = "border-box";
  input.style.minHeight = "34px";
  input.style.font = "inherit";
  input.style.width = "100%";

  return input;
}

function createSwapButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "入れ替え";
  button.style.minHeight = "34px";
  button.style.font = "inherit";
  button.style.fontWeight = "600";
  button.style.width = "100%";

  return button;
}

function createOutput(name: string): HTMLInputElement {
  const output = createNumberInput(name, "");
  output.readOnly = true;
  output.placeholder = "変換結果";

  return output;
}

function replaceOptions(
  select: HTMLSelectElement,
  options: UnitOption[],
): void {
  select.replaceChildren(
    ...options.map(({ label, value }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );
}

function getValidUnitValue(
  category: Category,
  unitValue: UnitValue,
  fallbackValue: UnitValue,
): UnitValue {
  return category.units.some(({ value }) => value === unitValue)
    ? unitValue
    : fallbackValue;
}

async function restoreStoredSelection(
  categorySelect: HTMLSelectElement,
  afterRestore: (storedSelection: StoredSelection) => void,
): Promise<void> {
  const storedSelection = await loadStoredSelection();
  if (!storedSelection) {
    return;
  }

  const category = categories.find(
    ({ value }) => value === storedSelection.category,
  );
  if (!category) {
    return;
  }

  categorySelect.value = category.value;
  afterRestore(storedSelection);
}

async function loadStoredSelection(): Promise<StoredSelection | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY_LAST_SELECTION);
  const selection = result[STORAGE_KEY_LAST_SELECTION];

  if (!isStoredSelection(selection)) {
    return null;
  }

  return selection;
}

async function saveStoredSelection(selection: StoredSelection): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_LAST_SELECTION]: selection });
}

function isStoredSelection(value: unknown): value is StoredSelection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const selection = value as Record<string, unknown>;
  return (
    isOptionalString(selection.category) &&
    isOptionalString(selection.fromUnit) &&
    isOptionalString(selection.toUnit)
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

const conversionDefinitions: Record<
  CategoryValue,
  Record<UnitValue, ConversionDefinition>
> = {
  length: {
    m: { toBaseFactor: 1 },
    km: { toBaseFactor: 1000 },
    cm: { toBaseFactor: 0.01 },
    in: { toBaseFactor: 0.0254 },
    ft: { toBaseFactor: 0.3048 },
  },
  weight: {
    g: { toBaseFactor: 1 },
    kg: { toBaseFactor: 1000 },
    lb: { toBaseFactor: 453.59237 },
    oz: { toBaseFactor: 28.349523125 },
  },
  temperature: {
    c: {
      toBase: (value) => value,
      fromBase: (value) => value,
    },
    f: {
      toBase: (value) => (value - 32) * (5 / 9),
      fromBase: (value) => value * (9 / 5) + 32,
    },
    k: {
      toBase: (value) => value - 273.15,
      fromBase: (value) => value + 273.15,
    },
  },
  volume: {
    l: { toBaseFactor: 1 },
    ml: { toBaseFactor: 0.001 },
    m3: { toBaseFactor: 1000 },
    gal: { toBaseFactor: 3.785411784 },
  },
};

function convertUnit(
  value: number,
  categoryValue: CategoryValue,
  fromUnit: UnitValue,
  toUnit: UnitValue,
): number {
  const categoryDefinitions = conversionDefinitions[categoryValue];
  const fromDefinition = categoryDefinitions[fromUnit];
  const toDefinition = categoryDefinitions[toUnit];

  if (!fromDefinition || !toDefinition) {
    throw new Error("Unsupported unit conversion.");
  }

  const baseValue = convertToBase(value, fromDefinition);
  return convertFromBase(baseValue, toDefinition);
}

function convertToBase(value: number, definition: ConversionDefinition): number {
  if ("toBaseFactor" in definition) {
    return value * definition.toBaseFactor;
  }

  return definition.toBase(value);
}

function convertFromBase(
  value: number,
  definition: ConversionDefinition,
): number {
  if ("toBaseFactor" in definition) {
    return value / definition.toBaseFactor;
  }

  return definition.fromBase(value);
}

function formatConversionResult(value: number): string {
  if (Object.is(value, -0)) {
    return "0";
  }

  return Number.parseFloat(value.toPrecision(12)).toString();
}
