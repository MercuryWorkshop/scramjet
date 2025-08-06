({ location } = self);
({ location: a } = self);
({ location = parent } = self);
({ ["location"]: a } = self);
({ ["location"]: a = parent } = self);
({ parent: { location: x } } = self);
({ parent: { location: x = parent } } = self);
({ parent: { location } } = self);
