import inquirer from 'inquirer';
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
const contentDir = 'src/content/blog';

const generateFrontmatter = ({
  title,
  image,
  draft,
  date,
  accessPassword,
  accessHint,
  accessExcerpt
}) => {
  let frontmatter = '';
  if (title) frontmatter += `title: ${title}\n`;
  if (image) frontmatter += `image: ${image}\n`;
  if (draft) frontmatter += `draft: ${draft}\n`;
  if (date) frontmatter += `date: ${date}\n`;
  if (accessPassword) {
    frontmatter += `access:\n  password: ${JSON.stringify(accessPassword)}\n`;
    if (accessHint) frontmatter += `  hint: ${JSON.stringify(accessHint)}\n`;
    if (accessExcerpt) frontmatter += `  excerpt: ${JSON.stringify(accessExcerpt)}\n`;
  }
  return frontmatter;
}

const generateMarkdownTemplate = ({
  title,
  image,
  draft,
  date,
  accessPassword,
  accessHint,
  accessExcerpt
}) => (
`---
${generateFrontmatter({ title, image, draft, date, accessPassword, accessHint, accessExcerpt })}
---

## Title

Write your content here!
`);

async function validateTitle(title) {
  if (typeof title !== 'string') {
    return 'Please input a string!';
  }
  if (title.length === 0) {
    return 'Title should not be empty!';
  }
  const results = await Promise.allSettled([
    fs.stat(path.join(contentDir, `${title}.mdx`)),
    fs.stat(path.join(contentDir, `${title}.md`)),
    fs.stat(path.join(contentDir, `${title}`)),
  ]);

  if (results.some(result => result.status === 'fulfilled')) {
    return `Artile "${title}" already exists!`;
  }
  return true;
}


function exit() {
  console.log(chalk.red(`Creating procedure canceled!`));
  process.exit();
}

async function main() {
  const response = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: 'What\'s the article title?',
      validate: validateTitle
    },
    {
      type: 'confirm',
      name: 'draft',
      message: 'Is it a draft?',
      default: false,
      active: 'yes',
      inactive: 'no',
    },
    {
      type: 'input',
      name: 'image',
      message: 'What\'s the article image? (press enter to skip)',
    },
    {
      type: 'password',
      name: 'accessPassword',
      message: 'Access password? (press enter to skip)',
      mask: '*',
    },
    {
      type: 'input',
      name: 'accessHint',
      message: 'Password hint? (press enter to skip)',
      when: answers => Boolean(answers.accessPassword),
    },
    {
      type: 'input',
      name: 'accessExcerpt',
      message: 'Public excerpt for protected article? (press enter to skip)',
      when: answers => Boolean(answers.accessPassword),
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: answers => `We will create mdx file at ${path.join(contentDir, `${answers.title}.mdx`)}, continue?`,
      default: true,
    }
  ]);
  if (!response.confirm) exit();
  const createDate = new Date();
  const template = generateMarkdownTemplate({
    title: response.title,
    image: response.image,
    draft: response.draft,
    date: createDate.toISOString(),
    accessPassword: response.accessPassword,
    accessHint: response.accessHint,
    accessExcerpt: response.accessExcerpt,
  });
  const file = path.join(contentDir, `${response.title}.mdx`);
  await fs.writeFile(file, template, {
    flag: 'wx'
  });
  console.log(chalk.green(`Successfully created file at ${file}`));
}

main()
