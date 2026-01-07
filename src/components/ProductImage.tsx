import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  className?: string;
  width: number;
  height: number;
  priority?: boolean;
};

export function ProductImage({ src, alt, className, width, height, priority }: Props) {
  // Si es URL remota, usamos <img> para no depender de dominios permitidos por Next/Image.
  if (/^https?:\/\//i.test(src)) {
    return <img className={className} src={src} alt={alt} width={width} height={height} loading={priority ? "eager" : "lazy"} />;
  }

  return <Image className={className} src={src} alt={alt} width={width} height={height} priority={priority} />;
}

