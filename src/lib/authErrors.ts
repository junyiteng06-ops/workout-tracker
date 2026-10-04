import type { AuthError } from '@supabase/supabase-js';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'メールアドレスまたはパスワードが正しくありません。',
  email_not_confirmed: 'メールアドレスの確認が完了していません。届いた確認メールのリンクを開いてください。',
  user_already_exists: 'このメールアドレスはすでに登録されています。',
  email_exists: 'このメールアドレスはすでに登録されています。',
  weak_password: 'パスワードが弱すぎます。8文字以上で、英字と数字を組み合わせてください。',
  same_password: '現在と同じパスワードは設定できません。',
  email_address_invalid: 'このメールアドレスは使用できません。',
  over_email_send_rate_limit: 'メールの送信回数が上限に達しました。しばらく時間をおいてからお試しください。',
  over_request_rate_limit: 'リクエストが多すぎます。しばらく時間をおいてからお試しください。',
  signup_disabled: '現在、新規登録を受け付けていません。',
};

export function authErrorMessage(error: AuthError): string {
  return (error.code && MESSAGES[error.code]) || 'エラーが発生しました。時間をおいてもう一度お試しください。';
}
