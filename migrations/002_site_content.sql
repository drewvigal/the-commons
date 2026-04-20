CREATE TABLE site_content (
  key        text        PRIMARY KEY,
  value      text        NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_content (key, value) VALUES
  ('tagline', 'Explore what''s happening, find your community'),
  ('footer',  'The Commons is a public space. Show up. Form friendships. Build community.'),
  ('about:body',
   'You know how it goes. You mean to get out more, try something new, meet people outside your usual circle. But finding what''s happening — events worth your time, in your neighborhood, around your interests — takes more effort than it should. Most of us end up missing things we would have loved, simply because we never heard about them.

The Commons exists to fix that. We built a single, open calendar where community organizations, local media, and everyday people can share events and where anyone can find them — sorted by date, place, and interest. No algorithms deciding what you see. No tickets to buy. Just a straightforward answer to the question: what''s happening, and where do I fit in?

Robert Putnam saw this coming. In Bowling Alone, he documented the decades-long unraveling of American community life — the clubs we stopped joining, the neighbors we stopped knowing, the gatherings we stopped attending. More recently, his work has carried a sharper urgency: joining a club, showing up to something, is not a leisure choice. It is a civic act. The Commons is built around that belief.

Show up. Form friendships. Build community.'),
  ('how-it-works:intro',
   'The Commons is open to everyone. No login required to explore events, discover what''s happening in your neighborhood, or find something worth showing up for. But if you want to do more — save events, sync your calendar, or help build the community calendar itself — there''s a place for you here too.'),
  ('how-it-works:browsing',
   'Explore the full calendar. Filter by date, location, or interest. Find your next thing. That''s it — no friction, no signup wall, no algorithm deciding what you see. The Commons is a public space, and public spaces should be open.'),
  ('how-it-works:member',
   'A Commons membership lets you build your own list of events you''re planning to attend, sync that list directly to your Google or Outlook calendar, and embed a personal event feed on your website or blog. It''s your curated view of what''s happening, connected to the tools you already use.

Membership is free and takes thirty seconds with your Google account.'),
  ('how-it-works:curator',
   'Curators are the people who make The Commons possible. If you run a festival, publish a newsletter, lead a community organization, or simply have a gift for knowing what''s worth attending — this role is for you. Curators can add events directly to the public calendar, manage series of events, and share their curated lists with their own audiences.

This is civic work. Curators don''t just use The Commons — they build it, for everyone.');
