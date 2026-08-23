import * as React from 'react';

import Image from 'next/image';

/**
 * Logo component props
 *
 * @description Props for the application logo component.
 */
export type LogoProps = {
  /** Alt text for the logo image */
  alt?: string;
  /** Additional CSS classes */
  className?: string;
  /**
   * Custom test ID for testing
   * @default 'app-logo'
   */
  testId?: string;
};

/**
 * Logo component - Application branding image
 *
 * @description
 * Displays the application logo with responsive sizing for
 * sidebar collapsed/expanded states.
 *
 * ## Features
 * - **Responsive Sizing**: Adapts to sidebar collapse state
 * - **Next.js Image**: Optimized image loading
 * - **Customizable Alt**: Configurable accessibility text
 *
 * ## Use Cases
 * - Sidebar header branding
 * - Login/register page headers
 * - Email templates
 *
 * @example
 * ```tsx
 * <Logo alt="Company Logo" />
 * <Logo className="h-12 w-12" />
 * ```
 */
const Logo = React.forwardRef<HTMLImageElement, LogoProps>(
  ({ alt, className, testId = 'app-logo' }, ref) => {
    const altText = alt ?? 'AtoAxis logo';

    return (
      <Image
        alt={altText}
        className={`me-1 rounded-[5px] transition-all group-data-collapsible:size-6 group-data-[collapsible=icon]:size-8 ${className ?? ''}`}
        data-slot="logo"
        data-testid={testId}
        height={30}
        ref={ref}
        src="/atoaxis-logo-mark.png"
        width={30}
      />
    );
  }
);

Logo.displayName = 'Logo';

export { Logo };
export default Logo;
