export type FormState = {
  message: string;
  success?: boolean;
};

export type FormAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;
