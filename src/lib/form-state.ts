export type FormState = {
  message: string;
  success?: boolean;
  invitationUrl?: string;
};

export type FormAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;
