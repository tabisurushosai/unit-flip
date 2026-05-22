type UnitOption = {
  labelKey: string;
  value: string;
};

type UnitValue = UnitOption["value"];

type Category = {
  labelKey: string;
  value: string;
  premium?: boolean;
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

type StoredPremiumState = {
  purchased?: boolean;
  trialStartedAt?: string;
};

type FavoritePair = {
  category: CategoryValue;
  fromUnit: UnitValue;
  toUnit: UnitValue;
};

const STORAGE_KEY_LAST_SELECTION = "unitFlipLastSelection";
const STORAGE_KEY_PREMIUM_STATE = "unitFlipPremiumState";
const STORAGE_KEY_FAVORITE_PAIRS = "unitFlipFavoritePairs";
const STRIPE_CHECKOUT_URL = "https://checkout.stripe.com/c/pay/unit-flip";
const TRIAL_LENGTH_DAYS = 7;

const categories: Category[] = [
  {
    labelKey: "categoryLength",
    value: "length",
    units: [
      { labelKey: "unitMeter", value: "m" },
      { labelKey: "unitKilometer", value: "km" },
      { labelKey: "unitCentimeter", value: "cm" },
      { labelKey: "unitInch", value: "in" },
      { labelKey: "unitFoot", value: "ft" },
    ],
  },
  {
    labelKey: "categoryWeight",
    value: "weight",
    units: [
      { labelKey: "unitGram", value: "g" },
      { labelKey: "unitKilogram", value: "kg" },
      { labelKey: "unitPound", value: "lb" },
      { labelKey: "unitOunce", value: "oz" },
    ],
  },
  {
    labelKey: "categoryTemperature",
    value: "temperature",
    units: [
      { labelKey: "unitCelsius", value: "c" },
      { labelKey: "unitFahrenheit", value: "f" },
      { labelKey: "unitKelvin", value: "k" },
    ],
  },
  {
    labelKey: "categoryVolume",
    value: "volume",
    units: [
      { labelKey: "unitLiter", value: "l" },
      { labelKey: "unitMilliliter", value: "ml" },
      { labelKey: "unitCubicMeter", value: "m3" },
      { labelKey: "unitGallon", value: "gal" },
    ],
  },
  {
    labelKey: "categoryArea",
    value: "area",
    premium: true,
    units: [
      { labelKey: "unitSquareMeter", value: "m2" },
      { labelKey: "unitSquareKilometer", value: "km2" },
      { labelKey: "unitSquareFoot", value: "ft2" },
      { labelKey: "unitAcre", value: "acre" },
    ],
  },
  {
    labelKey: "categorySpeed",
    value: "speed",
    premium: true,
    units: [
      { labelKey: "unitMeterPerSecond", value: "mps" },
      { labelKey: "unitKilometerPerHour", value: "kph" },
      { labelKey: "unitMilePerHour", value: "mph" },
      { labelKey: "unitKnot", value: "kt" },
    ],
  },
  {
    labelKey: "categoryData",
    value: "data",
    premium: true,
    units: [
      { labelKey: "unitByte", value: "b" },
      { labelKey: "unitKilobyte", value: "kb" },
      { labelKey: "unitMegabyte", value: "mb" },
      { labelKey: "unitGigabyte", value: "gb" },
    ],
  },
];

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App container was not found.");
}

document.title = t("extName");
document.querySelector("#appTitle")?.replaceChildren(t("extName"));
app.replaceChildren(createPopup());

function createPopup(): HTMLElement {
  const root = document.createElement("main");
  root.style.display = "grid";
  root.style.gap = "12px";

  const premiumState: StoredPremiumState = {};
  let favoritePairs: FavoritePair[] = [];

  const categorySelect = createSelect("category", []);
  const input = createNumberInput("inputValue", "0");
  const fromSelect = createSelect("fromUnit", []);
  const output = createOutput("outputValue");
  const toSelect = createSelect("toUnit", []);
  const swapButton = createSwapButton();
  const premiumStatus = createMutedText();
  const startTrialButton = createActionButton("actionStartTrial");
  const checkoutUrl = createTextValue(STRIPE_CHECKOUT_URL);
  const favoriteButton = createActionButton("actionAddFavorite");
  const favoriteList = document.createElement("div");
  favoriteList.style.display = "grid";
  favoriteList.style.gap = "6px";

  const getActiveCategories = () =>
    categories.filter(({ premium }) => !premium || isPremiumActive(premiumState));

  const syncCategoryOptions = (preferredCategory = categorySelect.value) => {
    const activeCategories = getActiveCategories();
    replaceOptions(
      categorySelect,
      activeCategories.map(({ labelKey, value }) => ({ labelKey, value })),
    );
    categorySelect.value = activeCategories.some(
      ({ value }) => value === preferredCategory,
    )
      ? preferredCategory
      : activeCategories[0]?.value ?? "";
  };

  const syncUnitOptions = (
    preferredFromUnit = fromSelect.value,
    preferredToUnit = toSelect.value,
  ) => {
    const category =
      getActiveCategories().find(({ value }) => value === categorySelect.value) ??
      getActiveCategories()[0];

    if (!category) {
      return;
    }

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

  const renderPremiumState = () => {
    const premiumActive = isPremiumActive(premiumState);
    premiumStatus.textContent = getPremiumStatusText(premiumState);
    startTrialButton.disabled = Boolean(premiumState.trialStartedAt);
    favoriteButton.disabled = !premiumActive;
    renderFavoritePairs(
      favoriteList,
      favoritePairs,
      premiumActive,
      ({ category, fromUnit, toUnit }) => {
        syncCategoryOptions(category);
        syncUnitOptions(fromUnit, toUnit);
        updateConversion();
        saveSelection();
      },
      async (pairToRemove) => {
        favoritePairs = favoritePairs.filter(
          (pair) => !isSameFavoritePair(pair, pairToRemove),
        );
        await saveFavoritePairs(favoritePairs);
        renderPremiumState();
      },
    );
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
  startTrialButton.addEventListener("click", () => {
    premiumState.trialStartedAt = new Date().toISOString();
    void savePremiumState(premiumState);
    syncCategoryOptions();
    syncUnitOptions();
    updateConversion();
    renderPremiumState();
  });
  favoriteButton.addEventListener("click", () => {
    if (!isPremiumActive(premiumState)) {
      return;
    }

    const favoritePair = {
      category: categorySelect.value,
      fromUnit: fromSelect.value,
      toUnit: toSelect.value,
    };
    if (!favoritePairs.some((pair) => isSameFavoritePair(pair, favoritePair))) {
      favoritePairs = [...favoritePairs, favoritePair];
      void saveFavoritePairs(favoritePairs);
      renderPremiumState();
    }
  });

  syncCategoryOptions();
  syncUnitOptions();
  updateConversion();

  void initializePremium(premiumState, (loadedFavoritePairs) => {
    favoritePairs = loadedFavoritePairs;
    syncCategoryOptions();
    syncUnitOptions();
    updateConversion();
    renderPremiumState();
    void restoreStoredSelection(categorySelect, (storedSelection) => {
      syncCategoryOptions(storedSelection.category);
      syncUnitOptions(storedSelection.fromUnit, storedSelection.toUnit);
      updateConversion();
    });
  });
  renderPremiumState();

  root.append(
    createField(t("fieldCategory"), categorySelect),
    createField(t("fieldInput"), input),
    createField(t("fieldFromUnit"), fromSelect),
    swapButton,
    createField(t("fieldOutput"), output),
    createField(t("fieldToUnit"), toSelect),
    createPremiumSection(
      premiumStatus,
      startTrialButton,
      checkoutUrl,
      favoriteButton,
      favoriteList,
    ),
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
  return createActionButton("actionSwap");
}

function createActionButton(messageKey: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = t(messageKey);
  button.style.minHeight = "34px";
  button.style.font = "inherit";
  button.style.fontWeight = "600";
  button.style.width = "100%";

  return button;
}

function createOutput(name: string): HTMLInputElement {
  const output = createNumberInput(name, "");
  output.readOnly = true;
  output.placeholder = t("outputPlaceholder");

  return output;
}

function createMutedText(): HTMLParagraphElement {
  const text = document.createElement("p");
  text.style.margin = "0";
  text.style.color = "#555";
  text.style.fontSize = "12px";
  text.style.lineHeight = "1.4";

  return text;
}

function createTextValue(value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.readOnly = true;
  input.value = value;
  input.style.boxSizing = "border-box";
  input.style.font = "inherit";
  input.style.minHeight = "34px";
  input.style.width = "100%";

  return input;
}

function createPremiumSection(
  premiumStatus: HTMLElement,
  startTrialButton: HTMLButtonElement,
  checkoutUrl: HTMLInputElement,
  favoriteButton: HTMLButtonElement,
  favoriteList: HTMLElement,
): HTMLElement {
  const section = document.createElement("section");
  section.style.borderTop = "1px solid #ddd";
  section.style.display = "grid";
  section.style.gap = "8px";
  section.style.paddingTop = "12px";

  const title = document.createElement("strong");
  title.textContent = t("premiumTitle");

  section.append(
    title,
    premiumStatus,
    startTrialButton,
    createField(t("fieldCheckoutUrl"), checkoutUrl),
    favoriteButton,
    createField(t("fieldFavorites"), favoriteList),
  );

  return section;
}

function replaceOptions(
  select: HTMLSelectElement,
  options: UnitOption[],
): void {
  select.replaceChildren(
    ...options.map(({ labelKey, value }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = t(labelKey);
      return option;
    }),
  );
}

function t(messageName: string): string {
  return chrome.i18n.getMessage(messageName) || messageName;
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

async function initializePremium(
  premiumState: StoredPremiumState,
  afterLoad: (favoritePairs: FavoritePair[]) => void,
): Promise<void> {
  Object.assign(premiumState, await loadPremiumState());
  afterLoad(await loadFavoritePairs());
}

async function loadPremiumState(): Promise<StoredPremiumState> {
  const result = await chrome.storage.local.get(STORAGE_KEY_PREMIUM_STATE);
  const premiumState = result[STORAGE_KEY_PREMIUM_STATE];

  if (!isStoredPremiumState(premiumState)) {
    return {};
  }

  return premiumState;
}

async function savePremiumState(
  premiumState: StoredPremiumState,
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_PREMIUM_STATE]: premiumState });
}

function isStoredPremiumState(value: unknown): value is StoredPremiumState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const premiumState = value as Record<string, unknown>;
  return (
    (premiumState.purchased === undefined ||
      typeof premiumState.purchased === "boolean") &&
    isOptionalString(premiumState.trialStartedAt)
  );
}

function isPremiumActive(premiumState: StoredPremiumState): boolean {
  return Boolean(premiumState.purchased) || isTrialActive(premiumState);
}

function isTrialActive(premiumState: StoredPremiumState): boolean {
  if (!premiumState.trialStartedAt) {
    return false;
  }

  const trialStartedAt = new Date(premiumState.trialStartedAt).getTime();
  if (!Number.isFinite(trialStartedAt)) {
    return false;
  }

  const trialEndsAt =
    trialStartedAt + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() < trialEndsAt;
}

function getPremiumStatusText(premiumState: StoredPremiumState): string {
  if (premiumState.purchased) {
    return t("premiumStatusPurchased");
  }

  if (isTrialActive(premiumState) && premiumState.trialStartedAt) {
    const trialEndsAt = new Date(
      new Date(premiumState.trialStartedAt).getTime() +
        TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000,
    );
    return `${t("premiumStatusTrialActive")} ${trialEndsAt.toLocaleDateString()}`;
  }

  return premiumState.trialStartedAt
    ? t("premiumStatusTrialExpired")
    : t("premiumStatusFree");
}

async function loadFavoritePairs(): Promise<FavoritePair[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY_FAVORITE_PAIRS);
  const favoritePairs = result[STORAGE_KEY_FAVORITE_PAIRS];

  if (!Array.isArray(favoritePairs)) {
    return [];
  }

  return favoritePairs.filter(isFavoritePair);
}

async function saveFavoritePairs(favoritePairs: FavoritePair[]): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_FAVORITE_PAIRS]: favoritePairs,
  });
}

function isFavoritePair(value: unknown): value is FavoritePair {
  if (!value || typeof value !== "object") {
    return false;
  }

  const favoritePair = value as Record<string, unknown>;
  return (
    typeof favoritePair.category === "string" &&
    typeof favoritePair.fromUnit === "string" &&
    typeof favoritePair.toUnit === "string" &&
    categories.some(({ value }) => value === favoritePair.category)
  );
}

function renderFavoritePairs(
  container: HTMLElement,
  favoritePairs: FavoritePair[],
  premiumActive: boolean,
  onApply: (favoritePair: FavoritePair) => void,
  onRemove: (favoritePair: FavoritePair) => void,
): void {
  if (!premiumActive) {
    container.replaceChildren(createInlineMessage(t("favoritesPremiumOnly")));
    return;
  }

  if (favoritePairs.length === 0) {
    container.replaceChildren(createInlineMessage(t("favoritesEmpty")));
    return;
  }

  container.replaceChildren(
    ...favoritePairs.map((favoritePair) =>
      createFavoritePairRow(favoritePair, onApply, onRemove),
    ),
  );
}

function createInlineMessage(message: string): HTMLElement {
  const text = document.createElement("span");
  text.textContent = message;
  text.style.color = "#555";
  text.style.fontSize = "12px";
  text.style.fontWeight = "400";
  text.style.lineHeight = "1.4";

  return text;
}

function createFavoritePairRow(
  favoritePair: FavoritePair,
  onApply: (favoritePair: FavoritePair) => void,
  onRemove: (favoritePair: FavoritePair) => void,
): HTMLElement {
  const row = document.createElement("div");
  row.style.display = "grid";
  row.style.gap = "4px";
  row.style.gridTemplateColumns = "1fr auto";

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.textContent = formatFavoritePair(favoritePair);
  applyButton.style.font = "inherit";
  applyButton.style.minHeight = "30px";
  applyButton.style.overflow = "hidden";
  applyButton.style.textOverflow = "ellipsis";
  applyButton.style.whiteSpace = "nowrap";
  applyButton.addEventListener("click", () => onApply(favoritePair));

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = t("actionRemoveFavorite");
  removeButton.title = t("actionRemoveFavorite");
  removeButton.style.font = "inherit";
  removeButton.style.minHeight = "30px";
  removeButton.addEventListener("click", () => onRemove(favoritePair));

  row.append(applyButton, removeButton);
  return row;
}

function formatFavoritePair({ category, fromUnit, toUnit }: FavoritePair): string {
  const categoryDefinition = categories.find(({ value }) => value === category);
  const fromUnitDefinition = categoryDefinition?.units.find(
    ({ value }) => value === fromUnit,
  );
  const toUnitDefinition = categoryDefinition?.units.find(
    ({ value }) => value === toUnit,
  );

  return `${t(categoryDefinition?.labelKey ?? category)}: ${t(
    fromUnitDefinition?.labelKey ?? fromUnit,
  )} -> ${t(toUnitDefinition?.labelKey ?? toUnit)}`;
}

function isSameFavoritePair(
  firstPair: FavoritePair,
  secondPair: FavoritePair,
): boolean {
  return (
    firstPair.category === secondPair.category &&
    firstPair.fromUnit === secondPair.fromUnit &&
    firstPair.toUnit === secondPair.toUnit
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
  area: {
    m2: { toBaseFactor: 1 },
    km2: { toBaseFactor: 1000000 },
    ft2: { toBaseFactor: 0.09290304 },
    acre: { toBaseFactor: 4046.8564224 },
  },
  speed: {
    mps: { toBaseFactor: 1 },
    kph: { toBaseFactor: 0.2777777777777778 },
    mph: { toBaseFactor: 0.44704 },
    kt: { toBaseFactor: 0.5144444444444445 },
  },
  data: {
    b: { toBaseFactor: 1 },
    kb: { toBaseFactor: 1024 },
    mb: { toBaseFactor: 1048576 },
    gb: { toBaseFactor: 1073741824 },
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
