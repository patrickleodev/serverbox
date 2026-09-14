import { EntitySchema } from "typeorm";

export type Suggestion = {
  id: string;
  residentName: string;
  email: string | null;
  condominiumName: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
};

export const SuggestionEntity = new EntitySchema<Suggestion>({
  name: "Suggestion",
  tableName: "suggestions",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    residentName: {
      type: String,
      length: 120,
    },
    email: {
      type: String,
      length: 254,
      nullable: true,
    },
    condominiumName: {
      type: String,
      length: 160,
    },
    message: {
      type: "text",
    },
    createdAt: {
      type: Date,
      createDate: true,
    },
    updatedAt: {
      type: Date,
      updateDate: true,
    },
  },
});
