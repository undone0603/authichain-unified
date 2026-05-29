'use client';

import Image from 'next/image';

interface StaticImageGalleryProps {
  title: string;
  description: string;
  images: { src: string; alt: string; width: number; height: number }[];
}

export function StaticImageGallery({
  title,
  description,
  images,
}: StaticImageGalleryProps) {
  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">{title}</h2>
        <p className="text-xl text-purple-200 font-light max-w-2xl mx-auto">
          {description}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {images.map((image, index) => (
          <div
            key={index}
            className="relative w-full h-64 overflow-hidden rounded-lg shadow-lg"
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              className="transition-transform duration-300 hover:scale-105"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
