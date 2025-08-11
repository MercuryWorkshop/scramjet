({ eval } = self);
({ eval: a } = self);
({ eval = parent } = self);
({ ["eval"]: a } = self);
({ ["eval"]: a = parent } = self);
({ parent: { eval: x } } = self);
({ parent: { eval: x = parent } } = self);
({ parent: { eval} } = self);


({ location } = self);
console.log({ ...rest  } = self);
