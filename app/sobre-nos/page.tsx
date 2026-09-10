import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre nós | ServeBox",
  description:
    "Conheça a ServeBox, a forma simples de encontrar tubos de tênis para continuar jogando.",
};

const principles = [
  {
    title: "Jogo sem improviso",
    text: "Você não precisa interromper uma partida ou adiar o próximo treino por falta de bolas. A ServeBox aproxima os tubos de tênis de quem realmente vai usá-los.",
  },
  {
    title: "Escolha que combina com você",
    text: "Cada jogador tem uma rotina, um ritmo e uma preferência. Por isso, trabalhamos com opções que fazem sentido para diferentes frequências de jogo e marcas de tubos.",
  },
  {
    title: "Tudo mais simples",
    text: "Da escolha ao acompanhamento do seu saldo, a experiência foi pensada para ser clara. Menos tempo resolvendo detalhes e mais tempo em quadra.",
  },
];

const workflow = [
  "Você encontra tubos disponíveis no seu condomínio, perto da quadra e da próxima partida.",
  "Escolhe a opção que combina com seu jogo, sua frequência e suas preferências.",
  "Acompanha seus planos e compras com clareza, para manter a raquete pronta para o próximo set.",
];

export default function SobreNosPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-4 py-8 sm:px-10 lg:px-12 lg:py-12">
      <section className="grid gap-10 py-4 lg:grid-cols-[1.15fr_0.85fr] lg:py-8">
        <div className="flex flex-col justify-center">
          <div className="inline-flex w-max rounded-full border border-border bg-surface-strong px-4 py-2 text-sm font-medium text-slate-700">
            Sobre nós
          </div>

          <div className="mt-8 max-w-3xl space-y-6">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Seu próximo jogo começa com um tubo de tênis à mão.
            </h1>
            <p className="text-base leading-8 text-slate-600 sm:text-lg">
              A ServeBox nasceu para deixar mais fácil encontrar tubos de tênis
              quando você quer jogar. No seu condomínio, você escolhe o que faz
              sentido para a sua rotina e mantém a próxima partida em movimento.
            </p>
            <p className="text-base leading-8 text-slate-600 sm:text-lg">
              Nosso trabalho combina disponibilidade, organização e tecnologia.
              A parte técnica fica nos bastidores; para você, a experiência deve
              ser simples: encontrar seu tubo, escolher seu plano e voltar para a
              quadra.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/cliente/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-semibold !text-white transition hover:bg-blue-500 sm:w-auto"
            >
              Acessar área do cliente
            </Link>
            <Link
              href="/sugestoes"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900 sm:w-auto"
            >
              Enviar sugestão
            </Link>
          </div>
        </div>

        <aside className="self-start border-l-4 border-accent bg-surface p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
            O que nos move
          </p>
          <div className="mt-6 space-y-5 text-base leading-8 text-slate-700">
            <p>
              Um bom serviço para quadras aparece quando você encontra tubos
              disponíveis, escolhe o que prefere e consegue voltar a jogar sem
              transformar a compra em uma tarefa.
            </p>
            <p>
              Por isso, pensamos a ServeBox para acompanhar a sua rotina: prática
              o bastante para caber entre uma partida e outra e cuidadosa o
              bastante para deixar o esporte no centro da experiência.
            </p>
          </div>
        </aside>
      </section>

      <section className="grid gap-8 border-t border-border pt-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
            Como trabalhamos
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Tudo pensado para a rotina de quem joga.
          </h2>
          <div className="mt-6 space-y-4 text-base leading-8 text-slate-700">
            {workflow.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-200 border-y border-border">
          {principles.map((principle) => (
            <article key={principle.title} className="py-6 first:pt-0 last:pb-0">
              <div className="grid gap-3 md:grid-cols-[0.45fr_1fr]">
                <h3 className="text-lg font-semibold text-slate-900">
                  {principle.title}
                </h3>
                <p className="text-sm leading-7 text-slate-600">
                  {principle.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border py-10">
        <div className="max-w-4xl">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
            Próximo passo
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Queremos que comprar tubos seja parte natural da sua rotina de jogo.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">
            A página de sugestões existe para manter essa construção aberta. Se
            algo pode ficar mais claro, mais simples ou mais útil para você e
            seus jogos, a equipe pode transformar essa percepção em melhoria do
            serviço.
          </p>
          <div className="mt-7">
            <Link
              href="/sugestoes"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 sm:w-auto"
            >
              Compartilhar uma sugestão
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
