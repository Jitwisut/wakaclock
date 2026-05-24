export type BookingStatus = 'approved' | 'cancelled' | 'finished' | 'pending';

export interface Booking {
  date: string;
  endTime: string;
  id: string;
  name: string;
  phone: string;
  room: number;
  startTime: string;
  status: BookingStatus;
  timeSlot: string;
}

const DEFAULT_PHONE = '0812 3290 0992';

export const items: Booking[] = [
  {
    id: 'ID1928309',
    name: 'Renata',
    startTime: '07:00 PM',
    endTime: '08:00 PM',
    phone: DEFAULT_PHONE,
    status: 'finished',
    room: 1,
    timeSlot: '07:00 AM',
    date: new Date().toISOString().split('T')[0],
  },
  {
    id: 'ID1928310',
    name: 'Marcel',
    startTime: '07:00 PM',
    endTime: '08:00 PM',
    phone: DEFAULT_PHONE,
    status: 'cancelled',
    room: 2,
    timeSlot: '07:00 AM',
    date: new Date().toISOString().split('T')[0],
  },
  {
    id: 'ID1928311',
    name: 'Damar',
    startTime: '07:00 PM',
    endTime: '10:00 PM',
    phone: DEFAULT_PHONE,
    status: 'approved',
    room: 3,
    timeSlot: '07:00 AM',
    date: new Date().toISOString().split('T')[0],
  },
  {
    id: 'ID1928312',
    name: 'Renata',
    startTime: '09:00 PM',
    endTime: '10:00 PM',
    phone: DEFAULT_PHONE,
    status: 'pending',
    room: 1,
    timeSlot: '09:00 AM',
    date: new Date().toISOString().split('T')[0],
  },
  {
    id: 'ID1928313',
    name: 'Dr. Yosep',
    startTime: '09:00 PM',
    endTime: '10:00 PM',
    phone: DEFAULT_PHONE,
    status: 'approved',
    room: 2,
    timeSlot: '09:00 AM',
    date: new Date().toISOString().split('T')[0],
  },
  {
    id: 'ID1928314',
    name: 'Jauhari',
    startTime: '11:00 PM',
    endTime: '12:00 PM',
    phone: DEFAULT_PHONE,
    status: 'approved',
    room: 1,
    timeSlot: '11:00 AM',
    date: new Date().toISOString().split('T')[0],
  },
  {
    id: 'ID1928315',
    name: 'Anita',
    startTime: '11:00 PM',
    endTime: '12:00 PM',
    phone: DEFAULT_PHONE,
    status: 'approved',
    room: 2,
    timeSlot: '11:00 AM',
    date: new Date().toISOString().split('T')[0],
  },
];

export const timeSlots = [
  '07:00 AM',
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 AM',
  '13:00 AM',
];

export const rooms = [
  { value: '1', label: 'Room 1' },
  { value: '2', label: 'Room 2' },
  { value: '3', label: 'Room 3' },
  { value: '4', label: 'Room 4' },
  { value: '5', label: 'Room 5' },
  { value: '6', label: 'Room 6' },
  { value: '7', label: 'Room 7' },
];

export const statuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
