import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta = {
  title: "ShadCN/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>AB12 CDE</CardTitle>
        <CardDescription>Captured 12 minutes ago</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">
            Review
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm">8 photos · 2 pending sync</p>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Open album</Button>
      </CardFooter>
    </Card>
  ),
};
