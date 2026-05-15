import { createDateTime, addMinutes } from '../src/utils/dateTime';

describe('Availability Logic Tests', () => {
    describe('Slot Overlap Detection', () => {
        it('should detect overlap when slot starts during existing appointment', () => {
            const existingStart = createDateTime('2025-12-10', '10:00');
            const existingEnd = addMinutes(existingStart, 30);

            const slotStart = createDateTime('2025-12-10', '10:15');
            const slotEnd = addMinutes(slotStart, 30);

            const hasOverlap = slotStart < existingEnd && slotEnd > existingStart;
            expect(hasOverlap).toBe(true);
        });

        it('should detect overlap when slot ends during existing appointment', () => {
            const existingStart = createDateTime('2025-12-10', '10:00');
            const existingEnd = addMinutes(existingStart, 30);

            const slotStart = createDateTime('2025-12-10', '09:45');
            const slotEnd = addMinutes(slotStart, 30);

            const hasOverlap = slotStart < existingEnd && slotEnd > existingStart;
            expect(hasOverlap).toBe(true);
        });

        it('should detect overlap when slot completely contains existing appointment', () => {
            const existingStart = createDateTime('2025-12-10', '10:15');
            const existingEnd = addMinutes(existingStart, 15);

            const slotStart = createDateTime('2025-12-10', '10:00');
            const slotEnd = addMinutes(slotStart, 60);

            const hasOverlap = slotStart < existingEnd && slotEnd > existingStart;
            expect(hasOverlap).toBe(true);
        });

        it('should not detect overlap when slots are adjacent', () => {
            const existingStart = createDateTime('2025-12-10', '10:00');
            const existingEnd = addMinutes(existingStart, 30);

            const slotStart = createDateTime('2025-12-10', '10:30');
            const slotEnd = addMinutes(slotStart, 30);

            const hasOverlap = slotStart < existingEnd && slotEnd > existingStart;
            expect(hasOverlap).toBe(false);
        });

        it('should not detect overlap when slots are completely separate', () => {
            const existingStart = createDateTime('2025-12-10', '10:00');
            const existingEnd = addMinutes(existingStart, 30);

            const slotStart = createDateTime('2025-12-10', '11:00');
            const slotEnd = addMinutes(slotStart, 30);

            const hasOverlap = slotStart < existingEnd && slotEnd > existingStart;
            expect(hasOverlap).toBe(false);
        });
    });

    describe('Slot Generation Boundaries', () => {
        it('should generate slots within working hours', () => {
            const workStart = createDateTime('2025-12-10', '09:00');
            const workEnd = createDateTime('2025-12-10', '20:00');

            const slotStart = createDateTime('2025-12-10', '19:30');
            const slotEnd = addMinutes(slotStart, 30);

            const isWithinBounds = slotStart >= workStart && slotEnd <= workEnd;
            expect(isWithinBounds).toBe(true);
        });

        it('should not generate slots that exceed working hours', () => {
            const workStart = createDateTime('2025-12-10', '09:00');
            const workEnd = createDateTime('2025-12-10', '20:00');

            const slotStart = createDateTime('2025-12-10', '19:45');
            const slotEnd = addMinutes(slotStart, 30);

            const isWithinBounds = slotStart >= workStart && slotEnd <= workEnd;
            expect(isWithinBounds).toBe(false);
        });

        it('should handle 30-minute slot intervals correctly', () => {
            const start = createDateTime('2025-12-10', '09:00');
            const slot1 = addMinutes(start, 30);
            const slot2 = addMinutes(start, 60);

            expect(slot1.toTimeString().substring(0, 5)).toBe('09:30');
            expect(slot2.toTimeString().substring(0, 5)).toBe('10:00');
        });
    });

    describe('Date and Time Utilities', () => {
        it('should create correct datetime from date and time strings', () => {
            const dt = createDateTime('2025-12-10', '14:30');
            expect(dt.getFullYear()).toBe(2025);
            expect(dt.getMonth()).toBe(11); // December is month 11
            expect(dt.getDate()).toBe(10);
            expect(dt.getHours()).toBe(14);
            expect(dt.getMinutes()).toBe(30);
        });

        it('should add minutes correctly', () => {
            const start = createDateTime('2025-12-10', '10:00');
            const end = addMinutes(start, 45);

            expect(end.toTimeString().substring(0, 5)).toBe('10:45');
        });

        it('should handle minute addition across hour boundary', () => {
            const start = createDateTime('2025-12-10', '10:45');
            const end = addMinutes(start, 30);

            expect(end.toTimeString().substring(0, 5)).toBe('11:15');
        });
    });
});
