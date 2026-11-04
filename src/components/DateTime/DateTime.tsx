export interface DateTimeProps {
  date: Date;
  showTime?: boolean;
}

export default function DateTime({
  date,
  showTime = false,
}: DateTimeProps) {
  const dateString = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    ...(showTime ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(date);
  return (
    <time dateTime={date.toISOString()} title="北京时间（UTC+8）">{dateString}</time>
  );
}
