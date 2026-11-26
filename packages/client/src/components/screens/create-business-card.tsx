import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TimelessDateString } from '../../helpers/dates.js';
import { useBootstrapNewClient } from '../../hooks/use-bootstrap-new-client.js';
import { ROUTES } from '../../router/routes.js';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form.js';
import { Input } from '../ui/input.js';

const ROLES = [
  { id: 'business_owner', label: 'Business owner' },
  { id: 'accountant', label: 'Accountant' },
  { id: 'employee', label: 'Employee' },
] as const;

const formSchema = z.object({
  businessName: z.string().trim().min(1, 'Enter the business name'),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Use the three-letter country code, e.g. ISR'),
  initialAccounterYear: z
    .string()
    .regex(/^(\d{4})?$/, 'A four-digit year')
    .optional(),
  dateEstablished: z.string().optional(),
  ownerEmail: z.string().trim().email('Enter a valid email'),
  ownerRole: z.enum(['business_owner', 'accountant', 'employee']),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Super-admin onboarding: creates a new client business with `bootstrapNewClient`
 * (docs/super-user/super-admin-runbook.md) and its owner's invitation. When the owner is the person
 * signed in, the invitation is accepted right away so they land in the new business; otherwise the
 * invitation link is shown to send to the owner.
 *
 * Shown to anyone without a workspace; the API refuses everyone but super-admins.
 */
export function CreateBusinessCard({ email }: { email: string | null }): ReactElement {
  const navigate = useNavigate();
  const { fetching, bootstrapNewClient } = useBootstrapNewClient();
  const [invitation, setInvitation] = useState<{ link: string; ownerEmail: string } | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      businessName: '',
      countryCode: 'ISR',
      initialAccounterYear: String(new Date().getFullYear()),
      dateEstablished: '',
      ownerEmail: email ?? '',
      ownerRole: 'business_owner',
    },
  });

  const onSubmit = async (values: FormValues) => {
    const result = await bootstrapNewClient({
      businessName: values.businessName,
      countryCode: values.countryCode.toUpperCase(),
      ownerEmail: values.ownerEmail,
      ownerRole: values.ownerRole,
      ...(values.dateEstablished
        ? { dateEstablished: values.dateEstablished as TimelessDateString }
        : {}),
      ...(values.initialAccounterYear
        ? { initialAccounterYear: Number(values.initialAccounterYear) }
        : {}),
    });
    if (!result) return;
    const path = ROUTES.ACCEPT_INVITATION(result.invitationToken);
    if (email != null && values.ownerEmail.toLowerCase() === email.toLowerCase()) {
      navigate(path);
    } else {
      setInvitation({ link: `${window.location.origin}${path}`, ownerEmail: values.ownerEmail });
    }
  };

  if (invitation) {
    return (
      <Card className="text-left">
        <CardHeader>
          <CardTitle>Business created</CardTitle>
          <CardDescription>
            Send this invitation link to the owner. They sign in as {invitation.ownerEmail} and
            accept it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input readOnly value={invitation.link} onFocus={event => event.currentTarget.select()} />
          <Button type="button" onClick={() => void navigator.clipboard.writeText(invitation.link)}>
            Copy link
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="text-left">
      <CardHeader>
        <CardTitle>Create a business</CardTitle>
        <CardDescription>
          For Accounter super-admins: set up a new business and invite its owner.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country (ISO-3)</FormLabel>
                    <FormControl>
                      <Input maxLength={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="initialAccounterYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First accounting year</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" maxLength={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="dateEstablished"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date established (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="ownerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ownerRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner role</FormLabel>
                    <FormControl>
                      <select
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        {...field}
                      >
                        {ROLES.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" disabled={fetching} className="w-full">
              {fetching ? 'Creating…' : 'Create business'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
