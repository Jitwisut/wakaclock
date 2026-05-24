'use client';

import React, { useState } from 'react';

import Image from 'next/image';
import { FreeMode, Navigation, Thumbs } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

import type { Swiper as SwiperClass } from 'swiper/types';

import 'swiper/css';
import 'swiper/css/free-mode';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';

export default function ProductImageGallery() {
  const [thumbsSwiper, setThumbsSwiper] = useState<null | SwiperClass>(null);

  const images = [
    `/images/products/01.jpeg`,
    `/images/products/02.jpeg`,
    `/images/products/03.jpeg`,
    `/images/products/04.jpeg`,
    `/images/products/05.jpeg`,
    `/images/products/06.jpeg`,
  ];

  return (
    <div className="sticky top-20 space-y-4">
      <Swiper
        className="mySwiper2"
        loop
        modules={[FreeMode, Navigation, Thumbs]}
        navigation
        spaceBetween={10}
        style={
          {
            '--swiper-navigation-color': 'var(--primary)',
            '--swiper-pagination-color': 'var(--primary)',
          } as React.CSSProperties
        }
        thumbs={{ swiper: thumbsSwiper }}
      >
        {images.map((image) => (
          <SwiperSlide key={image}>
            <Image
              alt="shadcn/ui"
              className="aspect-3/2 w-full rounded-lg object-contain lg:aspect-square"
              height={300}
              src={image}
              unoptimized
              width={300}
            />
          </SwiperSlide>
        ))}
      </Swiper>
      <Swiper
        className="mySwiper mt-2"
        freeMode
        loop
        modules={[FreeMode, Navigation, Thumbs]}
        onSwiper={setThumbsSwiper}
        slidesPerView={4}
        spaceBetween={10}
        watchSlidesProgress
      >
        {images.map((image) => (
          <SwiperSlide className="group" key={image}>
            <figure className="group-[.swiper-slide-thumb-active]:border-primary overflow-hidden rounded-lg border opacity-70 group-[.swiper-slide-thumb-active]:opacity-100!">
              <Image
                alt="shadcn/ui"
                className="aspect-square w-full object-contain"
                height={300}
                src={image}
                unoptimized
                width={300}
              />
            </figure>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
