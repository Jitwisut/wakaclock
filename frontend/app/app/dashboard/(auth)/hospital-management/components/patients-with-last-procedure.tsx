import { ChevronRight } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const patients = [
  {
    id: 1,
    name: 'Olivia Martin',
    avatar: `/images/avatars/01.png`,
    email: 'olivia.martin@email.com',
    lastProcedure: 'Appendectomy',
    date: '2025-05-20',
  },
  {
    id: 2,
    name: 'Jackson Lee',
    avatar: `/images/avatars/02.png`,
    email: 'jackson.lee@email.com',
    lastProcedure: 'Knee Arthroscopy',
    date: '2025-05-18',
  },
  {
    id: 3,
    name: 'Isabella Nguyen',
    avatar: `/images/avatars/03.png`,
    email: 'isabella.nguyen@email.com',
    lastProcedure: 'Cataract Surgery',
    date: '2025-05-15',
  },
  {
    id: 4,
    name: 'William Chen',
    avatar: `/images/avatars/04.png`,
    email: 'william.chen@email.com',
    lastProcedure: 'Colonoscopy',
    date: '2025-05-12',
  },
  {
    id: 5,
    name: 'Can Jackson',
    avatar: `/images/avatars/05.png`,
    email: 'can.jackson@email.com',
    lastProcedure: 'Colonoscopy',
    date: '2025-08-12',
  },
];

export default function PatientsWithLastProcedure() {
  return (
    <Card className="col-span-3">
      <CardHeader className="relative">
        <CardTitle>Patients with Last Procedure</CardTitle>
        <CardAction className="-mt-2.5">
          <Button variant="outline">
            View All <ChevronRight />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-6">
          {patients.map((patient) => (
            <div className="flex" key={patient.id}>
              <Avatar>
                <AvatarImage alt="Avatar" src={patient.avatar} />
                <AvatarFallback>
                  {patient.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
              <div className="ml-3 space-y-1">
                <p className="leading-none font-medium">{patient.name}</p>
                <p className="text-muted-foreground text-sm">{patient.email}</p>
              </div>
              <div className="ml-auto space-y-1 text-end font-medium">
                <p className="text-sm">{patient.lastProcedure}</p>
                <p className="text-muted-foreground text-sm">{patient.date}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
