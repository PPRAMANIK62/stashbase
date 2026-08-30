export const rendererThemes = ['system', 'light', 'dark'] as const;
export const rendererInterfaceScales = ['small', 'default', 'large'] as const;

export type RendererTheme = (typeof rendererThemes)[number];
export type RendererInterfaceScale = (typeof rendererInterfaceScales)[number];

export interface RendererAppearance {
  theme: RendererTheme;
  interfaceScale: RendererInterfaceScale;
}

export const defaultRendererAppearance: RendererAppearance = {
  theme: 'system',
  interfaceScale: 'default',
};

function selectedValue<const Value extends string>(
  value: unknown,
  allowed: readonly Value[],
  fallback: Value,
): Value {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

export function resolveRendererAppearance(
  theme: unknown,
  interfaceScale: unknown,
): RendererAppearance {
  return {
    theme: selectedValue(theme, rendererThemes, defaultRendererAppearance.theme),
    interfaceScale: selectedValue(
      interfaceScale,
      rendererInterfaceScales,
      defaultRendererAppearance.interfaceScale,
    ),
  };
}

export function applyRendererAppearance(
  root: HTMLElement,
  appearance: RendererAppearance,
  prefersDark = false,
): void {
  root.dataset.theme = appearance.theme;
  root.dataset.uiScale = appearance.interfaceScale;
  root.classList.toggle(
    'dark',
    appearance.theme === 'dark' || (appearance.theme === 'system' && prefersDark),
  );
}
