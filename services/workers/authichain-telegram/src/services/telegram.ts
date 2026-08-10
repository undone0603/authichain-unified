export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  reply_markup?: object
  disable_web_page_preview?: boolean
}

export class Telegram {
  constructor(private token: string) {}

  async call(method: string, body: object): Promise<Response> {
    return fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  sendMessage(
    chat_id: string | number,
    text: string,
    options: SendMessageOptions = {}
  ): Promise<Response> {
    return this.call('sendMessage', { chat_id, text, ...options })
  }

  answerInlineQuery(inline_query_id: string, results: object[]): Promise<Response> {
    return this.call('answerInlineQuery', { inline_query_id, results })
  }
}
