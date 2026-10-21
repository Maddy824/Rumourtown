/** Authored inner lives. Motive weights are design hypotheses, never psychological measurements. */
import type { SocialCharacter } from '../../sim/types.js';
import type { CastId } from './ids.js';

const person = (aspiration: string, worry: string, habit: string, protect: number, bond: number, status: number, verify: number): SocialCharacter =>
  ({ aspiration, worry, habit, motives: { protect, bond, status, verify } });

export const characters: Partial<Record<CastId, SocialCharacter>> = {
  mira: person('Keep the bakery dependable enough to hand it to Wren one day.', 'One missing loaf feels like someone taking her years of work for granted.', 'Counts the trays twice before joining the evening crowd at the well.', .8, .35, .65, .55),
  tom: person('Build things that make the village easier to live in.', 'Being called unreliable hurts more than losing a day’s pay.', 'Checks on Ada before taking on another repair.', .9, .4, .1, .7),
  ben: person('Make sure nobody he loves has to face trouble alone.', 'His loyalty can turn a doubtful story into a fight.', 'Brings river news into the bakery, then stays longer than he meant to.', .95, .9, .3, .2),
  ada: person('Finish a shawl that will outlast this miserable illness.', 'People are beginning to talk around her as if she were already gone.', 'Receives visitors by her loom and notices what they leave unsaid.', .7, .5, .35, .9),
  rosa: person('Keep an inn where every newcomer can find a seat.', 'Silence at the tables feels like people no longer need her.', 'Carries news between the well, the bridge and the supper tables.', .65, 1, .5, .25),
  jonah: person('Make the fair successful enough that the mill gets its due.', 'Mira gets credit while his contributions go unnoticed.', 'Lingers over flour prices whenever someone mentions the bakery.', .35, .45, .95, .45),
  elin: person('Teach the children to ask a second question.', 'A confident voice can drown out a careful one.', 'Asks who saw it before deciding who to believe.', .8, .45, .25, 1),
  pim: person('Run a shop that can survive a bad harvest.', 'A favour may turn into a debt nobody remembers owing.', 'Checks his ledger before joining a conversation.', .35, .4, .8, .8),
  sol: person('Bring in a good harvest and finally dance at the fair.', 'A private joy will become the village’s next joke.', 'Practises steps where he thinks the field hides him.', .55, .55, .3, .5),
  greta: person('Leave enough after the harvest to help the school.', 'Generosity will be mistaken for weakness.', 'Delivers eggs early and listens more than she admits.', .8, .35, .4, .75),
  ivo: person('Keep the tools and carts of the village in working order.', 'Borrowed tools will never find their way home.', 'Judges a promise by what someone actually brings back.', .6, .35, .55, .85),
  nell: person('Care for people without making them feel indebted.', 'Someone will delay asking for help because of shame.', 'Stops at doorsteps on the way to gather herbs.', 1, .7, .1, .85),
  otto: person('Make the chapel a place where people can make amends.', 'His curiosity is stronger than his sermons about gossip.', 'Asks for details and then remembers to sound disapproving.', .75, .8, .55, .45),
  wren: person('Be trusted with a whole morning’s baking.', 'A mistake will convince Mira she is still a child.', 'Hums while working and goes quiet when someone notices.', .65, .7, .65, .5),
  hal: person('Keep the road open and neighbours supplied.', 'The village will decide he is only useful for his cart.', 'Returns from a delivery with a favour done and a story heard.', .7, .85, .4, .45),
  dag: person('Keep the bridge safe and earn respect for the work.', 'Ben treats his rules as a joke.', 'Watches each crossing, but keeps his own kindness private.', .8, .3, .85, .65),
  una: person('Earn enough to choose which washing she takes in.', 'Mab will tell everyone about the damaged dress.', 'Talks while scrubbing and stops when her own name comes up.', .5, .85, .7, .35),
  cass: person('Keep the orchard healthy and the bees undisturbed.', 'People will mistake quietness for indifference.', 'Leaves honey as thanks and stays clear of noisy crowds.', .85, .35, .1, .85),
  fen: person('Learn enough from Elin to write a letter without help.', 'The others will laugh if they discover the lessons.', 'Carves small gifts during the long hours with the sheep.', .75, .4, .2, .7),
  lio: person('Play one tune the whole inn remembers.', 'Nobody will listen unless he makes himself interesting.', 'Turns an awkward silence into a tune or a story.', .4, 1, .85, .2),
  mab: person('Make clothes that people notice for the right reasons.', 'Cheap cloth will damage the reputation she has stitched together.', 'Notices sleeves, hems and who can suddenly afford new ones.', .3, .7, .95, .45),
  rook: person('Give the forgotten a little dignity.', 'People see his work before they see him.', 'Leaves flowers quietly and chooses his words with care.', .9, .25, .1, .9),
  tess: person('Keep the supper room warm even on a bad evening.', 'Helping one person will be read as taking sides.', 'Remembers who has eaten and who is pretending not to be hungry.', .95, .9, .2, .6),
  yan: person('Be welcome when he returns with his tools next season.', 'A travelling person is easy to blame once he has left.', 'Mends something small before asking for a place to sleep.', .65, .75, .4, .65),
};
