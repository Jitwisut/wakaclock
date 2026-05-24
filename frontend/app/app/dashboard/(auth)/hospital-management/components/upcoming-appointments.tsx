import { ChevronRight, MoreVerticalIcon } from 'lucide-react';

import { ExportButton } from '@/components/CardActionMenus';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const appointments = [
  {
    id: 1,
    patient: 'John Swift',
    date: '2023-06-01',
    time: '10:00 AM',
    doctor: 'Dr. Smith',
    department: 'Cardiology',
  },
  {
    id: 2,
    patient: 'Jane Smith',
    date: '2023-06-02',
    time: '11:30 AM',
    doctor: 'Dr. Johnson',
    department: 'Neurology',
  },
  {
    id: 3,
    patient: 'Bob Wilson',
    date: '2023-06-03',
    time: '2:00 PM',
    doctor: 'Dr. Brown',
    department: 'Oncology',
  },
  {
    id: 4,
    patient: 'Alice Taylor',
    date: '2023-06-04',
    time: '3:30 PM',
    doctor: 'Dr. Davis',
    department: 'Pediatrics',
  },
  {
    id: 5,
    patient: 'Bill Galon',
    date: '2023-06-04',
    time: '2:30 PM',
    doctor: 'Dr. Karen',
    department: 'Neurology',
  },
  {
    id: 6,
    patient: 'Mike Dall',
    date: '2023-06-04',
    time: '2:30 PM',
    doctor: 'Dr. Karen',
    department: 'Cardiology',
  },
  {
    id: 7,
    patient: 'Bob Wilson',
    date: '2023-06-03',
    time: '2:00 PM',
    doctor: 'Dr. Brown',
    department: 'Oncology',
  },
];

export default function UpcomingAppointments() {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Upcoming Appointments</CardTitle>
        <CardAction className="-mt-2.5">
          <div className="flex gap-2">
            <ExportButton />
            <Button variant="outline">
              <ChevronRight />
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Department</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell className="font-medium">{appointment.patient}</TableCell>
                  <TableCell>{appointment.date}</TableCell>
                  <TableCell>{appointment.time}</TableCell>
                  <TableCell>{appointment.doctor}</TableCell>
                  <TableCell>{appointment.department}</TableCell>
                  <TableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="h-auto py-1" size="icon" variant="ghost">
                          <MoreVerticalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>View</DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
