import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Input } from "./input";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "./field";

const meta = {
  title: "ShadCN/Field",
  component: Field,
  tags: ["autodocs"],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <FieldSet className="w-full max-w-sm">
      <FieldLegend>Capture details</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="album-name">Album name</FieldLabel>
          <Input id="album-name" placeholder="AB12 CDE" />
          <FieldDescription>Usually the vehicle plate number.</FieldDescription>
        </Field>
        <FieldSeparator>Optional</FieldSeparator>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="album-notes">Notes</FieldLabel>
            <FieldDescription>Paragraphs separated by a blank line.</FieldDescription>
          </FieldContent>
          <Input id="album-notes" placeholder="Front bumper" />
        </Field>
        <Field data-invalid="true">
          <FieldLabel htmlFor="album-error">Position</FieldLabel>
          <Input id="album-error" aria-invalid defaultValue="-1" />
          <FieldError>Position must be positive.</FieldError>
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll("[data-slot=field]")).toHaveLength(3);
    await expect(canvasElement.querySelector("[data-slot=field-error]")).toHaveTextContent(
      "Position must be positive.",
    );
  },
};
