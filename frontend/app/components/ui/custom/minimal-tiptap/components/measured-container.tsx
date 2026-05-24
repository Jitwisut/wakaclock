import * as React from 'react';
import { useContainerSize } from '../hooks/use-container-size';

/** Props for the MeasuredContainer component */
export interface MeasuredContainerProps<T extends React.ElementType> {
  /** The element type to render as */
  as: T;
  /** Name used for CSS custom property prefix */
  name: string;
  /** Child elements to render */
  children?: React.ReactNode;
}

/**
 * A container component that measures its dimensions and exposes them as CSS custom properties.
 * Useful for creating responsive layouts that need to know container size.
 */
export const MeasuredContainer = React.forwardRef(
  <T extends React.ElementType>(
    {
      as: Component,
      name,
      children,
      style = {},
      ...props
    }: MeasuredContainerProps<T> & React.ComponentProps<T>,
    ref: React.Ref<HTMLElement>
  ) => {
    const innerRef = React.useRef<HTMLElement>(null);
    const [element, setElement] = React.useState<HTMLElement | null>(null);
    const rect = useContainerSize(element);

    const setRef = React.useCallback((node: HTMLElement | null) => {
      innerRef.current = node;
      setElement(node);
    }, []);

    React.useImperativeHandle(ref, () => innerRef.current as HTMLElement);

    const customStyle = {
      [`--${name}-width`]: `${rect.width}px`,
      [`--${name}-height`]: `${rect.height}px`,
    };

    return (
      <Component
        data-slot="measured-container"
        data-testid="measured-container"
        {...props}
        ref={setRef}
        style={{ ...customStyle, ...style }}
      >
        {children}
      </Component>
    );
  }
);

MeasuredContainer.displayName = 'MeasuredContainer';
