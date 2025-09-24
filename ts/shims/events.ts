export function trigger(
  name: string,
  param1?: any,
  param2?: any,
  param3?: any,
  param4?: any,
  param5?: any,
  param6?: any
) {
  // @ts-ignore
  if (window.Whisper?.events?.trigger) {
    // @ts-ignore
    window.Whisper.events.trigger(
      name,
      param1,
      param2,
      param3,
      param4,
      param5,
      param6
    );
  }
}
