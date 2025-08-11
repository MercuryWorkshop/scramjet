describe('Storage', () => {
  it('clearDataForOrigin', async () => {
    localStorage.setItem('name', 'chobitsu')
    sessionStorage.setItem('license', 'mit')
    await chobitsu.sendMessage('Storage.clearDataForOrigin', {
      storageTypes: 'local_storage',
    })
    expect(localStorage.getItem('name')).to.be.null
    expect(sessionStorage.getItem('license')).to.be.null
  })
})
