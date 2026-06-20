const BASE_URL =
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis';

export function fluentEmoji(category: string, name: string, size = 25): string {
  const path = `${category}/${name}.png`.replace(/ /g, '%20');

  return `<img src="${BASE_URL}/${path}" alt="${name}" width="${size}" height="${size}" style="vertical-align: middle; background: none" />`;
}
