import {
  AchievementByYear,
  ChartProjectEfficiency,
  ChartProjectOverview,
  Reminders,
  Reports,
  SuccessMetrics,
  SummaryCards,
  TableRecentProjects,
} from '@/app/dashboard/(auth)/project-management/components';
import { ExportButton } from '@/components/CardActionMenus';
import { CalendarDateRangePicker } from '@/components/custom-date-range-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateMeta } from '@/lib/utils';

export async function generateMetadata() {
  return generateMeta({
    title: 'Project Admin Dashboard',
    description:
      'The project management admin dashboard template provides a powerful and intuitive interface for tracking tasks, deadlines, and team progress to ensure project success.',
    canonical: '/project-management',
  });
}

export default function Page() {
  return (
    <>
      <div className="mb-4 flex flex-row items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Project Dashboard</h1>
        <div className="flex items-center space-x-2">
          <CalendarDateRangePicker />
          <ExportButton />
        </div>
      </div>

      <Tabs className="space-y-4" defaultValue="overview">
        <TabsList className="z-10">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger disabled value="activities">
            Activities
          </TabsTrigger>
        </TabsList>
        <TabsContent className="space-y-4" value="overview">
          <SummaryCards />
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ChartProjectOverview />
            </div>
            <SuccessMetrics />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
            <Reminders />
            <AchievementByYear />
            <ChartProjectEfficiency />
          </div>
          <TableRecentProjects />
        </TabsContent>
        <TabsContent value="reports">
          <Reports />
        </TabsContent>
        <TabsContent value="activities">...</TabsContent>
      </Tabs>
    </>
  );
}
