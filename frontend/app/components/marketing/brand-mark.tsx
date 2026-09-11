import Image from 'next/image';

/** Decorative beside the written brand name; the link already has its accessible name. */
export function BrandMark() {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className="axis-brand-mark"
      height={36}
      loading="eager"
      sizes="36px"
      src="/atoaxis-symbol-v2.png"
      width={36}
    />
  );
}
