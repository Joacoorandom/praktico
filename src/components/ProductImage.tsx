import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  fill?: boolean;
};

export function ProductImage({ src, alt, className, width, height, priority, fill }: Props) {
  const isRemote = /^https?:\/\//i.test(src);
  
  // Si fill está activo, usamos el modo fill de Next.js
  if (fill) {
    if (isRemote) {
      return (
        <img 
          className={className} 
          src={src} 
          alt={alt}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
          loading={priority ? "eager" : "lazy"} 
        />
      );
    }
    return <Image className={className} src={src} alt={alt} fill priority={priority} style={{ objectFit: "cover" }} />;
  }

  // Si es URL remota, usamos <img> para no depender de dominios permitidos por Next/Image.
  if (isRemote) {
    return (
      <img 
        className={className} 
        src={src} 
        alt={alt} 
        width={width} 
        height={height} 
        loading={priority ? "eager" : "lazy"}
        style={{ objectFit: "cover" }}
      />
    );
  }

  return (
    <Image 
      className={className} 
      src={src} 
      alt={alt} 
      width={width || 400} 
      height={height || 300} 
      priority={priority}
      style={{ objectFit: "cover" }}
    />
  );
}

