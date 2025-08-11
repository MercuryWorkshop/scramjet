describe('DOM', () => {
  it('getNodeId', async () => {
    const node = document.createElement('div')
    const domain = chobitsu.domain('DOM')
    const { nodeId } = domain.getNodeId({ node })
    expect(nodeId).to.be.a('number')
    expect(domain.getOuterHTML({ nodeId }).outerHTML).to.equal(node.outerHTML)
  })
})
