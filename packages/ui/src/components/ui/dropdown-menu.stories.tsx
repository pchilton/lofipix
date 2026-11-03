import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  title: "ShadCN/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Album actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>AB12 CDE</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={fn()}>Open album</DropdownMenuItem>
        <DropdownMenuItem onSelect={fn()}>Add photos</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={fn()}>
          Delete album
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Album actions" }));
    const menu = await screen.findByRole("menu");
    await expect(menu).toBeInTheDocument();
    await expect(screen.getByText("AB12 CDE")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Add photos" }));
  },
};
