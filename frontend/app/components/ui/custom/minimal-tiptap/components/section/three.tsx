import * as React from 'react';
import type { Editor } from '@tiptap/react';
import type { toggleVariants } from '@/components/ui/toggle';
import type { VariantProps } from 'class-variance-authority';
import { CaretDownIcon, CheckIcon } from '@radix-ui/react-icons';
import { ToolbarButton } from '../toolbar-button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '../../hooks/use-theme';

/**
 * Localization labels for the SectionThree component.
 * Provides customizable strings for text color options.
 */
export type SectionThreeLabels = {
  textColor: string;
  default: string;
  boldBlue: string;
  boldTeal: string;
  boldGreen: string;
  boldOrange: string;
  boldRed: string;
  boldPurple: string;
  gray: string;
  blue: string;
  teal: string;
  green: string;
  orange: string;
  red: string;
  purple: string;
  white: string;
  black: string;
  blueSubtle: string;
  tealSubtle: string;
  greenSubtle: string;
  yellowSubtle: string;
  redSubtle: string;
  purpleSubtle: string;
};

/**
 * Internal color item configuration for the color picker.
 */
interface ColorItem {
  cssVar: string;
  label: string;
  darkLabel?: string;
}

/**
 * Internal color palette configuration grouping related colors.
 */
interface ColorPalette {
  label: string;
  colors: ColorItem[];
  inverse: string;
}

const DEFAULT_LABELS: SectionThreeLabels = {
  textColor: 'Text color',
  default: 'Default',
  boldBlue: 'Bold blue',
  boldTeal: 'Bold teal',
  boldGreen: 'Bold green',
  boldOrange: 'Bold orange',
  boldRed: 'Bold red',
  boldPurple: 'Bold purple',
  gray: 'Gray',
  blue: 'Blue',
  teal: 'Teal',
  green: 'Green',
  orange: 'Orange',
  red: 'Red',
  purple: 'Purple',
  white: 'White',
  black: 'Black',
  blueSubtle: 'Blue subtle',
  tealSubtle: 'Teal subtle',
  greenSubtle: 'Green subtle',
  yellowSubtle: 'Yellow subtle',
  redSubtle: 'Red subtle',
  purpleSubtle: 'Purple subtle',
};

const createPalettes = (labels: SectionThreeLabels): ColorPalette[] => [
  {
    label: 'Palette 1',
    inverse: 'hsl(var(--background))',
    colors: [
      { cssVar: 'hsl(var(--foreground))', label: labels.default },
      { cssVar: 'var(--mt-accent-bold-blue)', label: labels.boldBlue },
      { cssVar: 'var(--mt-accent-bold-teal)', label: labels.boldTeal },
      { cssVar: 'var(--mt-accent-bold-green)', label: labels.boldGreen },
      { cssVar: 'var(--mt-accent-bold-orange)', label: labels.boldOrange },
      { cssVar: 'var(--mt-accent-bold-red)', label: labels.boldRed },
      { cssVar: 'var(--mt-accent-bold-purple)', label: labels.boldPurple },
    ],
  },
  {
    label: 'Palette 2',
    inverse: 'hsl(var(--background))',
    colors: [
      { cssVar: 'var(--mt-accent-gray)', label: labels.gray },
      { cssVar: 'var(--mt-accent-blue)', label: labels.blue },
      { cssVar: 'var(--mt-accent-teal)', label: labels.teal },
      { cssVar: 'var(--mt-accent-green)', label: labels.green },
      { cssVar: 'var(--mt-accent-orange)', label: labels.orange },
      { cssVar: 'var(--mt-accent-red)', label: labels.red },
      { cssVar: 'var(--mt-accent-purple)', label: labels.purple },
    ],
  },
  {
    label: 'Palette 3',
    inverse: 'hsl(var(--foreground))',
    colors: [
      { cssVar: 'hsl(var(--background))', label: labels.white, darkLabel: labels.black },
      { cssVar: 'var(--mt-accent-blue-subtler)', label: labels.blueSubtle },
      { cssVar: 'var(--mt-accent-teal-subtler)', label: labels.tealSubtle },
      { cssVar: 'var(--mt-accent-green-subtler)', label: labels.greenSubtle },
      { cssVar: 'var(--mt-accent-yellow-subtler)', label: labels.yellowSubtle },
      { cssVar: 'var(--mt-accent-red-subtler)', label: labels.redSubtle },
      { cssVar: 'var(--mt-accent-purple-subtler)', label: labels.purpleSubtle },
    ],
  },
];

const MemoizedColorButton = React.memo<{
  color: ColorItem;
  isSelected: boolean;
  isDarkMode: boolean;
  inverse: string;
  onClick: (value: string) => void;
}>(({ color, isSelected, isDarkMode, inverse, onClick }) => {
  const label = isDarkMode && color.darkLabel ? color.darkLabel : color.label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroupItem
          tabIndex={0}
          className="relative size-7 rounded-md p-0"
          value={color.cssVar}
          aria-label={label}
          style={{ backgroundColor: color.cssVar }}
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.preventDefault();
            onClick(color.cssVar);
          }}
        >
          {isSelected && (
            <CheckIcon className="absolute inset-0 m-auto size-6" style={{ color: inverse }} />
          )}
        </ToggleGroupItem>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
});

MemoizedColorButton.displayName = 'MemoizedColorButton';

const MemoizedColorPicker = React.memo<{
  palette: ColorPalette;
  selectedColor: string;
  isDarkMode: boolean;
  inverse: string;
  onColorChange: (value: string) => void;
}>(({ palette, selectedColor, isDarkMode, inverse, onColorChange }) => (
  <ToggleGroup
    type="single"
    value={selectedColor}
    onValueChange={(value: string) => {
      if (value) onColorChange(value);
    }}
    className="gap-1.5"
  >
    {palette.colors.map((color) => (
      <MemoizedColorButton
        key={color.cssVar}
        inverse={inverse}
        color={color}
        isSelected={selectedColor === color.cssVar}
        isDarkMode={isDarkMode}
        onClick={onColorChange}
      />
    ))}
  </ToggleGroup>
));

MemoizedColorPicker.displayName = 'MemoizedColorPicker';

/**
 * Props for the SectionThree component.
 * Controls text color selection in the toolbar.
 */
export interface SectionThreeProps extends VariantProps<typeof toggleVariants> {
  /** The TipTap editor instance */
  editor: Editor;
  /** Custom labels for localization */
  labels?: Partial<SectionThreeLabels>;
}

/**
 * SectionThree - Text color picker for the minimal TipTap toolbar.
 * Provides a popover with color palettes for text color selection.
 */
export const SectionThree = React.forwardRef<HTMLDivElement, SectionThreeProps>(
  ({ editor, labels, size, variant }, ref) => {
    const isDarkMode = useTheme();
    const mergedLabels = React.useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
    const palettes = React.useMemo(() => createPalettes(mergedLabels), [mergedLabels]);

    const color = editor.getAttributes('textStyle')?.color || 'hsl(var(--foreground))';
    const [selectedColor, setSelectedColor] = React.useState(color);

    const handleColorChange = React.useCallback(
      (value: string) => {
        const didSetColor = editor.chain().focus().setColor(value).run();
        if (!didSetColor) return;
        setSelectedColor(value);
      },
      [editor]
    );

    React.useEffect(() => {
      setSelectedColor(color);
    }, [color]);

    return (
      <div ref={ref} data-slot="section-three" data-testid="section-three">
        <Popover>
          <PopoverTrigger asChild>
            <ToolbarButton
              tooltip={mergedLabels.textColor}
              aria-label={mergedLabels.textColor}
              className="w-12"
              disabled={editor.isActive('codeBlock')}
              size={size}
              variant={variant}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
                style={{ color: selectedColor }}
              >
                <path d="M4 20h16" />
                <path d="m6 16 6-12 6 12" />
                <path d="M8 12h8" />
              </svg>
              <CaretDownIcon className="size-5" />
            </ToolbarButton>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-full">
            <div className="space-y-1.5">
              {palettes.map((palette) => (
                <MemoizedColorPicker
                  key={palette.label}
                  palette={palette}
                  inverse={palette.inverse}
                  selectedColor={selectedColor}
                  isDarkMode={isDarkMode}
                  onColorChange={handleColorChange}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

SectionThree.displayName = 'SectionThree';

export default SectionThree;
