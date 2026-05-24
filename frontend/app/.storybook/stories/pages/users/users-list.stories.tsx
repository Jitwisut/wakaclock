import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { buttonHandlers } from '@/.storybook/stories/_handlers/button.handlers';
import { tableHandlers } from '@/.storybook/stories/_handlers/table.handlers';
import { userHandlers, userStatusHandlers } from '@/.storybook/stories/_handlers/user.handlers';
import { createFakeUser, createFakeUsers } from '@/.storybook/stories/_factories/user.factory';
import { createFakeTableRow } from '@/.storybook/stories/_factories/table.factory';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Columns, MoreHorizontal, PlusCircle } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Mock users data
type UserStatus = 'active' | 'inactive' | 'pending';

interface User {
  country: string;
  email: string;
  id: number;
  image: string;
  name: string;
  plan_name: string;
  role: string;
  status: UserStatus;
}

const mockUsers: User[] = [
  {
    id: 1,
    name: i18n.t('usersList.story.nameJohnSmith', 'John Smith'),
    email: 'john.smith@example.com',
    role: i18n.t('usersList.story.roleProjectManager', 'Project Manager'),
    plan_name: i18n.t('usersList.story.planEnterprise', 'Enterprise'),
    country: i18n.t('usersList.story.countryUnitedStates', 'United States'),
    status: 'active',
    image: '/images/avatars/01.png',
  },
  {
    id: 2,
    name: i18n.t('usersList.story.nameSarahJohnson', 'Sarah Johnson'),
    email: 'sarah.johnson@example.com',
    role: i18n.t('usersList.story.roleArchitect', 'Architect'),
    plan_name: i18n.t('usersList.story.planTeam', 'Team'),
    country: i18n.t('usersList.story.countryCanada', 'Canada'),
    status: 'active',
    image: '/images/avatars/02.png',
  },
  {
    id: 3,
    name: i18n.t('usersList.story.nameMikeWilson', 'Mike Wilson'),
    email: 'mike.wilson@example.com',
    role: i18n.t('usersList.story.roleConstructionForeman', 'Construction Foreman'),
    plan_name: i18n.t('usersList.story.planBasic', 'Basic'),
    country: i18n.t('usersList.story.countryUnitedKingdom', 'United Kingdom'),
    status: 'pending',
    image: '/images/avatars/03.png',
  },
  {
    id: 4,
    name: i18n.t('usersList.story.nameEmilyDavis', 'Emily Davis'),
    email: 'emily.davis@example.com',
    role: i18n.t('usersList.story.roleSurveyor', 'Surveyor'),
    plan_name: i18n.t('usersList.story.planTeam', 'Team'),
    country: i18n.t('usersList.story.countryAustralia', 'Australia'),
    status: 'active',
    image: '/images/avatars/04.png',
  },
  {
    id: 5,
    name: i18n.t('usersList.story.nameJamesBrown', 'James Brown'),
    email: 'james.brown@example.com',
    role: i18n.t('usersList.story.roleElectrician', 'Electrician'),
    plan_name: i18n.t('usersList.story.planBasic', 'Basic'),
    country: i18n.t('usersList.story.countryGermany', 'Germany'),
    status: 'inactive',
    image: '/images/avatars/05.png',
  },
  {
    id: 6,
    name: i18n.t('usersList.story.nameLisaAnderson', 'Lisa Anderson'),
    email: 'lisa.anderson@example.com',
    role: i18n.t('usersList.story.roleEstimator', 'Estimator'),
    plan_name: i18n.t('usersList.story.planEnterprise', 'Enterprise'),
    country: i18n.t('usersList.story.countryFrance', 'France'),
    status: 'active',
    image: '/images/avatars/06.png',
  },
];

const statusValues = ['active', 'inactive', 'pending'] as const;
const planValues = ['basic', 'team', 'enterprise'] as const;

function getStatusVariant(status: UserStatus): 'destructive' | 'success' | 'warning' {
  if (status === 'active') return 'success';
  if (status === 'inactive') return 'destructive';
  return 'warning';
}

function generateAvatarFallback(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function UsersListDemo() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  const statusLabelMap: Record<string, string> = {
    active: t('usersList.story.statusActive', 'Active'),
    inactive: t('usersList.story.statusInactive', 'Inactive'),
    pending: t('usersList.story.statusPending', 'Pending'),
  };

  const planLabelMap: Record<string, string> = {
    basic: t('usersList.story.planBasic', 'Basic'),
    team: t('usersList.story.planTeam', 'Team'),
    enterprise: t('usersList.story.planEnterprise', 'Enterprise'),
  };

  const statuses = statusValues.map((value) => ({ value, label: statusLabelMap[value] }));
  const plans = planValues.map((value) => ({ value, label: planLabelMap[value] }));

  const filteredUsers = mockUsers.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleRowSelection = (userId: number) => {
    if (selectedRows.includes(userId)) {
      setSelectedRows(selectedRows.filter((id) => id !== userId));
    } else {
      setSelectedRows([...selectedRows, userId]);
    }
  };

  const toggleAllRows = () => {
    if (selectedRows.length === filteredUsers.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredUsers.map((u) => u.id));
    }
  };

  return (
    <div className="h-[90vh] overflow-auto p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {i18n.t('usersList.story.users', 'Users')}
          </h1>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />{' '}
            {t('usersPage.story.addNewUser', 'Add New User')}
          </Button>
        </div>

        <div className="w-full">
          <div className="flex items-center gap-4 py-4">
            <div className="flex gap-2">
              <Input
                className="max-w-sm"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('usersList.story.searchUsersPlaceholder', 'Search users...')}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <PlusCircle />
                    {t('usersPage.story.status', 'Status')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-0">
                  <Command>
                    <CommandInput
                      className="h-9"
                      placeholder={t('usersList.story.statusPlaceholder', 'Status')}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {i18n.t('usersList.story.noStatusFound', 'No status found.')}
                      </CommandEmpty>
                      <CommandGroup>
                        {statuses.map((status) => (
                          <CommandItem key={status.value} value={status.value}>
                            <div className="flex items-center space-x-3 py-1">
                              <Checkbox id={status.value} />
                              <label htmlFor={status.value}>{status.label}</label>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <PlusCircle />
                    {t('usersPage.story.plan', 'Plan')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-0">
                  <Command>
                    <CommandInput
                      className="h-9"
                      placeholder={t('usersList.story.planPlaceholder', 'Plan')}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {i18n.t('usersList.story.noPlanFound', 'No plan found.')}
                      </CommandEmpty>
                      <CommandGroup>
                        {plans.map((plan) => (
                          <CommandItem key={plan.value} value={plan.value}>
                            <div className="flex items-center space-x-3 py-1">
                              <Checkbox id={plan.value} />
                              <label htmlFor={plan.value}>{plan.label}</label>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="ml-auto" variant="outline">
                  <Columns />{' '}
                  <span className="hidden md:inline">
                    {i18n.t('usersList.story.columns', 'Columns')}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem checked>
                  {i18n.t('usersList.story.name', 'Name')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked>
                  {i18n.t('usersList.story.role', 'Role')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked>
                  {i18n.t('usersList.story.plan', 'Plan')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked>
                  {i18n.t('usersList.story.email', 'Email')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked>
                  {i18n.t('usersList.story.country', 'Country')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked>
                  {i18n.t('usersList.story.status', 'Status')}
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      aria-label={t('usersList.story.selectAll', 'Select all')}
                      checked={selectedRows.length === filteredUsers.length}
                      onCheckedChange={toggleAllRows}
                    />
                  </TableHead>
                  <TableHead>{i18n.t('usersList.story.name', 'Name')}</TableHead>
                  <TableHead>
                    <Button className="-ml-3" variant="ghost">
                      {t('usersPage.story.sortRole', 'Role')}
                      <ArrowUpDown />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button className="-ml-3" variant="ghost">
                      {t('usersPage.story.sortPlan', 'Plan')}
                      <ArrowUpDown />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button className="-ml-3" variant="ghost">
                      {t('usersPage.story.sortEmail', 'Email')}
                      <ArrowUpDown />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button className="-ml-3" variant="ghost">
                      {t('usersPage.story.sortCountry', 'Country')}
                      <ArrowUpDown />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button className="-ml-3" variant="ghost">
                      {t('usersPage.story.sortStatus', 'Status')}
                      <ArrowUpDown />
                    </Button>
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow data-state={selectedRows.includes(user.id) && 'selected'} key={user.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={t('usersList.story.selectRow', 'Select row')}
                        checked={selectedRows.includes(user.id)}
                        onCheckedChange={() => toggleRowSelection(user.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage alt={user.name} src={user.image} />
                          <AvatarFallback>{generateAvatarFallback(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="capitalize">{user.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.plan_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.country}</TableCell>
                    <TableCell>
                      <Badge className="capitalize" variant={getStatusVariant(user.status)}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <span className="sr-only">
                              {i18n.t('usersList.story.openMenu', 'Open menu')}
                            </span>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            {i18n.t('usersList.story.viewUser', 'View user')}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            {i18n.t('usersList.story.delete', 'Delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-4">
            <div className="text-muted-foreground flex-1 text-sm">
              {t('usersPage.story.rowsSelected', '{{selected}} of {{total}} row(s) selected.', {
                selected: selectedRows.length,
                total: filteredUsers.length,
              })}
            </div>
            <div className="space-x-2">
              <Button size="sm" variant="outline">
                {t('usersPage.story.previous', 'Previous')}
              </Button>
              <Button size="sm" variant="outline">
                {t('usersPage.story.next', 'Next')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTableDemo() {
  return (
    <div className="p-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t('usersList.story.name', 'Name')}</TableHead>
              <TableHead>{i18n.t('usersList.story.role', 'Role')}</TableHead>
              <TableHead>{i18n.t('usersList.story.status', 'Status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockUsers.slice(0, 3).map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage alt={user.name} src={user.image} />
                      <AvatarFallback>{generateAvatarFallback(user.name)}</AvatarFallback>
                    </Avatar>
                    <div>{user.name}</div>
                  </div>
                </TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(user.status)}>{user.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Pages/Users/Users List',
  component: UsersListDemo,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: [...buttonHandlers, ...tableHandlers, ...userHandlers] },
    docs: {
      description: {
        component:
          'Users List Page - User management page with TanStack Table featuring search, status/plan/role filters via Command popovers, sortable columns, row selection with checkboxes, and action dropdown menus.',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof UsersListDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// STORIES
// ============================================================================

export const Default: Story = {
  name: i18n.t('usersList.storyName.default', 'Full Page'),
  render: () => <UsersListDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('heading', { level: 1 })).toBeInTheDocument();
  },
};

export const UsersTable: Story = {
  name: i18n.t('usersList.storyName.usersTable', 'Users Table'),
  render: () => <UsersTableDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Dark: Story = {
  name: i18n.t('usersList.storyName.dark', 'Dark Mode'),
  parameters: { themes: { themeOverride: 'dark' } },
  render: () => <UsersListDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Japanese: Story = {
  name: i18n.t('usersList.storyName.japanese', 'Japanese'),
  parameters: { locale: 'ja' },
  render: () => <UsersListDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const RTL: Story = {
  name: i18n.t('usersList.storyName.rTL', 'RTL'),
  parameters: { direction: 'rtl' },
  render: () => (
    <div dir="rtl">
      <UsersListDemo />
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
  tags: ['!test'],
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.error400BadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: userStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.error401Unauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: userStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.error403Forbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: userStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.error404NotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: userStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.error409Conflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: userStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.error422UnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: userStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.error429RateLimit', 'Handler: Rate Limit'),
  parameters: { msw: { handlers: userStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.error500InternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: userStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.error502BadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: userStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.error503ServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: userStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.error504GatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: userStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.loading', 'Handler: Loading'),
  parameters: { msw: { handlers: userStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.slowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: userStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.networkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: userStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('usersList.storyName.emptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: userStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function FactoryDataDemo() {
  const { t } = useTranslation();
  const user = createFakeUser();
  const users = createFakeUsers(3);
  const tableRow = createFakeTableRow();
  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-lg font-semibold">
        {t('common.factoryGeneratedData', 'Factory Generated Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-4 text-xs">
        {JSON.stringify({ user, users, tableRow }, null, 2)}
      </pre>
    </div>
  );
}

export const FactoryData: Story = {
  name: i18n.t('usersList.storyName.factoryData', 'Factory: Generated Data'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('factory-data-demo')).toBeInTheDocument();
  },
};
