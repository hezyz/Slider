export interface OriginalSegmentModel {
  id: number;
  text: string;
  translation: string;
  startTime: number;
  endTime: number;
  slide: number;
  type: string;
}

export interface SegmentModel {
  id: number;
  text: string;
  translation: string;
  slide: number;
  delayStartSeconds: number;
  delayEndSeconds: number;
}

export interface SliderWithSegmentsModel {
  id: number;
  sliderImagePath: string;
  segments: SegmentModel[];
}