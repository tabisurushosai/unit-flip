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

  const syncUnitOptions = () => {
    const category =
      categories.find(({ value }) => value === categorySelect.value) ??
      categories[0];

    replaceOptions(fromSelect, category.units);
    replaceOptions(toSelect, category.units);

    if (category.units[1]) {
      toSelect.value = category.units[1].value;
    }
  };

  categorySelect.addEventListener("change", syncUnitOptions);
  syncUnitOptions();

  root.append(
    createField("カテゴリ", categorySelect),
    createField("入力", input),
    createField("変換元", fromSelect),
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
