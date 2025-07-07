import { Injectable } from '@angular/core';
import { OriginalSegmentModel, SegmentModel } from './segment.model';

@Injectable({ providedIn: 'root' })
export class SegmentService {

    async saveSegmentsToFile(data: any, projectName: string, fileName: string): Promise<void> {
        try {
            await window.electron.writeJsonFile(projectName, fileName, data);
        } catch (error) {
            console.error('Error saving segments to file:', error);
            throw new Error('Failed to save segments.');
        }
    }

    async writeSegmentsToFile(data: any, projectName: string, fileName: string): Promise<SegmentModel[]> {
        const segments = this.convertToOriginalSegmentModels(data || []);
        const convertedData = this.convertToSegmentModel(segments);
        await window.electron.writeJsonFile(projectName, fileName, convertedData);
        return convertedData;
    }

    private convertToSegmentModel(input: any[]): SegmentModel[] {
        return input
            .filter(segment => segment.type !== 'silence')
            .map((segment, index) => ({
                id: index + 1,
                text: segment.text,
                translation: segment.translation,
                slide: segment.slide,
                delayStartSeconds: 0,
                delayEndSeconds: 0
            }));
    }

    private convertToOriginalSegmentModels(jsonArray: any[]): OriginalSegmentModel[] {
        return jsonArray.map((item, index) => ({
            id: index,
            text: item.text ?? '',
            translation: item.en ?? '', // default empty; update later if needed
            startTime: item.start ?? 0,
            endTime: item.end ?? 0,
            slide: item.slide ?? 0,
            type: item.type ?? 'text'
        }));
    }
}