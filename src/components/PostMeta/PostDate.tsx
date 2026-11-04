import DateTime from '@/components/DateTime';

export interface PostMetaProps extends React.ComponentPropsWithoutRef<'div'> {
  createdDate: Date;
  date: Date;
  updateDate: Date;
}
export default function PostMeta({
  createdDate,
  date,
  updateDate,
  ...rest
}: PostMetaProps) {
  const dates = [
    { label: '创建时间', value: createdDate },
    { label: '首次上传', value: date },
    { label: '最后修改', value: updateDate },
  ];
  return (
    <div {...rest}>
      <dl className="flex flex-wrap gap-x-5 gap-y-2">
        {dates.map(({ label, value }) => (
          <div key={label}>
            <dt className="mb-1 opacity-70">{label}</dt>
            <dd><DateTime date={value} showTime /></dd>
          </div>
        ))}
      </dl>
      <span className="mt-2 block text-xs opacity-60">北京时间（UTC+8）</span>
    </div>
  );
}
