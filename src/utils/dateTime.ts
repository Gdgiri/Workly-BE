export const parseTime = (timeStr: string): { hours: number; minutes: number } => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
};

export const createDateTime = (dateStr: string, timeStr: string): Date => {
    const date = new Date(dateStr);
    const { hours, minutes } = parseTime(timeStr);
    date.setHours(hours, minutes, 0, 0);
    return date;
};

export const addMinutes = (date: Date, minutes: number): Date => {
    return new Date(date.getTime() + minutes * 60000);
};

export const formatTime = (date: Date): string => {
    return date.toTimeString().substring(0, 5);
};

export const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

export const getDayName = (date: Date): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
};
