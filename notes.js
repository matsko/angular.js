

if (noParentAnimation) {
  scheduler.schedule(animationFn);
} else {
  scheduler.scheduleWith(parent, animate);
}

STATE_ANIMATING = -1
STATE_QUEUED = 0

1. ngClass (body > div > div)
  classBased?
    => no active parents?
      => add to schedule for immediate start (slot = 0)
        => schedule.schedule(FN1);

            FN1

2. ngClass (body > div)
  classBased?
    => active parents? no?
    => query the children and figure out what the index is:e .
      => move this BEFORE the parent
        => schedule.schedule(SLOT, beforeOrAfter, FN2);

            FN2
              \
                FN1

3. ngClass (body > div2)
  classBased?
    => active parents?
      => move this AFTER the parent
        => schedule.schedule(SLOT, beforeOrAfter, FN3);

            FN2
            / \
          FN1   FN3

4. ngClass (body)
  classBased?
    => active parents?
      => move this BEFORE the parent
        => schedule.schedule(SLOT, beforeOrAfter, FN4);

        BODY has parent with animation (no)


          FN4
            \
            FN2
            / \
          FN1   FN3
